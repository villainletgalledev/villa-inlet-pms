import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { isOwnerOrManager, UserRole } from '../../lib/rbac';
import { authenticateRequest } from '../auth';

const router = express.Router();

/**
 * GET /api/inventory
 * Fetch all inventory items grouped/filter-ready with stock level indicators and summary metrics.
 * Open to all authenticated staff roles.
 */
router.get('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  try {
    const category = req.query.category as string | undefined;
    const lowStockOnly = req.query.lowStockOnly === 'true';

    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }

    const items = await prismaClient.inventoryItem.findMany({
      where,
      include: {
        transactions: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            relatedRoom: { select: { id: true, roomNumber: true, name: true } },
            performedBy: { select: { id: true, fullName: true, email: true, role: true } },
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const itemsWithStatus = items.map((item) => {
      const isLowStock = item.currentStock <= item.lowStockThreshold;
      const isOutOfStock = item.currentStock === 0;
      return {
        ...item,
        isLowStock,
        isOutOfStock,
        stockRatio: item.lowStockThreshold > 0 ? item.currentStock / item.lowStockThreshold : 1,
      };
    });

    const filteredItems = lowStockOnly
      ? itemsWithStatus.filter((i) => i.isLowStock)
      : itemsWithStatus;

    // Aggregate summary statistics
    const totalItems = items.length;
    const lowStockCount = items.filter((i) => i.currentStock <= i.lowStockThreshold).length;
    const outOfStockCount = items.filter((i) => i.currentStock === 0).length;
    const categoriesCount = new Set(items.map((i) => i.category)).size;

    return res.json({
      items: filteredItems,
      summary: {
        totalItems,
        lowStockCount,
        outOfStockCount,
        categoriesCount,
      },
    });
  } catch (err: any) {
    console.error('Error fetching inventory items:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch inventory' });
  }
});

/**
 * GET /api/inventory/:id
 * Returns single item details with complete transaction history audit trail.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { id } = req.params;

  try {
    const item = await prismaClient.inventoryItem.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          include: {
            relatedRoom: { select: { id: true, roomNumber: true, name: true } },
            performedBy: { select: { id: true, fullName: true, email: true, role: true } },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const isLowStock = item.currentStock <= item.lowStockThreshold;
    const isOutOfStock = item.currentStock === 0;

    return res.json({
      item: {
        ...item,
        isLowStock,
        isOutOfStock,
      },
    });
  } catch (err: any) {
    console.error(`Error fetching item ${id}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to fetch inventory item' });
  }
});

/**
 * POST /api/inventory
 * Create a new inventory item.
 * RBAC: OWNER or MANAGER ONLY.
 */
router.post('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Forbidden: Only Owners and Managers can create inventory items.',
    });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { name, category, unit, currentStock = 0, lowStockThreshold = 5, notes } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Item name is required.' });
  }

  const initialStockNum = Math.max(0, parseInt(String(currentStock), 10) || 0);
  const thresholdNum = Math.max(0, parseInt(String(lowStockThreshold), 10) || 5);

  try {
    let internalUserId = caller.id;
    if (caller.email) {
      const user = await prismaClient.user.findUnique({ where: { email: caller.email } });
      if (user) internalUserId = user.id;
    }

    const result = await prismaClient.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          name: name.trim(),
          category: category || 'OTHER',
          unit: (unit || 'pcs').trim(),
          currentStock: initialStockNum,
          lowStockThreshold: thresholdNum,
          notes: notes ? notes.trim() : null,
        },
      });

      if (initialStockNum > 0) {
        await tx.inventoryTransaction.create({
          data: {
            itemId: item.id,
            type: 'RESTOCK',
            quantity: initialStockNum,
            performedByUserId: internalUserId || null,
            note: 'Initial stock on item creation',
          },
        });
      }

      return item;
    });

    return res.status(201).json({ item: result, success: true });
  } catch (err: any) {
    console.error('Error creating inventory item:', err);
    return res.status(500).json({ error: err.message || 'Failed to create inventory item' });
  }
});

/**
 * PUT /api/inventory/:id or PATCH /api/inventory/:id
 * Update item definition (name, category, unit, threshold, notes).
 * RBAC: OWNER or MANAGER ONLY.
 */
router.put('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Forbidden: Only Owners and Managers can edit inventory item definitions.',
    });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { id } = req.params;
  const { name, category, unit, lowStockThreshold, notes } = req.body;

  try {
    const existing = await prismaClient.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updated = await prismaClient.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(unit !== undefined && { unit: unit.trim() }),
        ...(lowStockThreshold !== undefined && {
          lowStockThreshold: Math.max(0, parseInt(String(lowStockThreshold), 10) || 0),
        }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      },
    });

    return res.json({ item: updated, success: true });
  } catch (err: any) {
    console.error(`Error updating item ${id}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to update inventory item' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  // Delegate to PUT handler
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Forbidden: Only Owners and Managers can edit inventory item definitions.',
    });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { id } = req.params;
  const { name, category, unit, lowStockThreshold, notes } = req.body;

  try {
    const updated = await prismaClient.inventoryItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(unit !== undefined && { unit: unit.trim() }),
        ...(lowStockThreshold !== undefined && {
          lowStockThreshold: Math.max(0, parseInt(String(lowStockThreshold), 10) || 0),
        }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      },
    });

    return res.json({ item: updated, success: true });
  } catch (err: any) {
    console.error(`Error patching item ${id}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to update inventory item' });
  }
});

/**
 * DELETE /api/inventory/:id
 * Delete an inventory item and all its transaction history.
 * RBAC: OWNER or MANAGER ONLY.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Forbidden: Only Owners and Managers can delete inventory items.',
    });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { id } = req.params;

  try {
    await prismaClient.inventoryItem.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (err: any) {
    console.error(`Error deleting item ${id}:`, err);
    return res.status(500).json({ error: err.message || 'Failed to delete item' });
  }
});

/**
 * POST /api/inventory/:id/transaction
 * Log restock, usage, or count adjustment transaction.
 * Updates currentStock server-side in the same atomic database transaction.
 * Never allows currentStock to go negative — returns 400 error.
 * Open to ALL authenticated staff (OWNER, MANAGER, STAFF, HOUSEKEEPER, MAINTENANCE).
 */
router.post('/:id/transaction', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prismaClient = getPrisma();
  if (!prismaClient) {
    return res.status(500).json({ error: 'Database client unavailable' });
  }

  const { id } = req.params;
  const { type, quantity, relatedRoomId, note } = req.body;

  if (!type || !['RESTOCK', 'USAGE', 'ADJUSTMENT'].includes(type)) {
    return res.status(400).json({ error: 'Valid transaction type (RESTOCK, USAGE, ADJUSTMENT) is required.' });
  }

  const rawQty = parseInt(String(quantity), 10);
  if (isNaN(rawQty) || rawQty === 0) {
    return res.status(400).json({ error: 'Quantity must be a non-zero whole number.' });
  }

  // Calculate signed delta for the transaction
  let delta = 0;
  if (type === 'RESTOCK') {
    if (rawQty <= 0) {
      return res.status(400).json({ error: 'Restock quantity must be positive.' });
    }
    delta = rawQty;
  } else if (type === 'USAGE') {
    // Usage is signed negative
    delta = -Math.abs(rawQty);
  } else if (type === 'ADJUSTMENT') {
    delta = rawQty; // can be positive or negative
  }

  try {
    let internalUserId = caller.id;
    if (caller.email) {
      const user = await prismaClient.user.findUnique({ where: { email: caller.email } });
      if (user) internalUserId = user.id;
    }

    // Atomic transaction to check and update stock
    const result = await prismaClient.$transaction(async (tx) => {
      const currentItem = await tx.inventoryItem.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new Error('ITEM_NOT_FOUND');
      }

      const nextStock = currentItem.currentStock + delta;
      if (nextStock < 0) {
        const attemptedUsage = Math.abs(delta);
        throw new Error(
          `INSUFFICIENT_STOCK: Current stock is ${currentItem.currentStock} ${currentItem.unit}, cannot deduct ${attemptedUsage} ${currentItem.unit}.`
        );
      }

      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId: id,
          type: type as any,
          quantity: delta,
          relatedRoomId: relatedRoomId || null,
          performedByUserId: internalUserId || null,
          note: note ? note.trim() : null,
        },
        include: {
          relatedRoom: { select: { id: true, roomNumber: true, name: true } },
          performedBy: { select: { id: true, fullName: true, email: true, role: true } },
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          currentStock: nextStock,
        },
        include: {
          transactions: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              relatedRoom: { select: { id: true, roomNumber: true, name: true } },
              performedBy: { select: { id: true, fullName: true, email: true, role: true } },
            },
          },
        },
      });

      return { updatedItem, transaction };
    });

    return res.status(201).json({
      success: true,
      item: result.updatedItem,
      transaction: result.transaction,
      message: `Stock updated successfully. New balance: ${result.updatedItem.currentStock} ${result.updatedItem.unit}`,
    });
  } catch (err: any) {
    if (err.message === 'ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }
    if (err.message && err.message.startsWith('INSUFFICIENT_STOCK:')) {
      const msg = err.message.replace('INSUFFICIENT_STOCK: ', '');
      return res.status(400).json({ error: msg });
    }
    console.error('Error logging inventory transaction:', err);
    return res.status(500).json({ error: err.message || 'Failed to log inventory transaction' });
  }
});

export default router;
