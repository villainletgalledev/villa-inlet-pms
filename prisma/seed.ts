import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Villa Inlet rooms...');

  const rooms = [
    {
      roomNumber: 'V-101',
      name: 'Oceanfront Master Villa',
      maxOccupancy: 2,
      basePrice: 450.0,
      amenities: [
        'King Bed',
        'Ocean View',
        'Private Plunge Pool',
        'En-suite Jacuzzi',
        'High-speed Wi-Fi',
        'Espresso Machine',
        'Walk-in Closet',
        'Balcony',
      ],
      description:
        'Our premier master suite perched overlooking the bay. Features a private plunge pool, panoramic ocean views, and king-size luxury linens.',
      imageUrls: [
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'AVAILABLE' as const,
    },
    {
      roomNumber: 'V-102',
      name: 'Sunset Cliff Suite',
      maxOccupancy: 2,
      basePrice: 380.0,
      amenities: [
        'King Bed',
        'Sunset View',
        'Private Terrace',
        'Rain Shower',
        'Mini Bar',
        'High-speed Wi-Fi',
        'Air Conditioning',
      ],
      description:
        'Experience golden hour views directly from your private terrace. Furnished with teak wood accents and an open-concept rain shower.',
      imageUrls: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'OCCUPIED' as const,
    },
    {
      roomNumber: 'V-103',
      name: 'Garden Oasis Pavilion',
      maxOccupancy: 2,
      basePrice: 320.0,
      amenities: [
        'Queen Bed',
        'Botanical Garden View',
        'Outdoor Stone Bathtub',
        'Smart TV',
        'Safe',
        'Work Desk',
        'Espresso Machine',
      ],
      description:
        'Surrounded by lush tropical greenery, featuring an intimate outdoor stone bath and secluded garden patio.',
      imageUrls: [
        'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'CLEANING' as const,
    },
    {
      roomNumber: 'V-104',
      name: 'Azure Horizon Room',
      maxOccupancy: 2,
      basePrice: 290.0,
      amenities: [
        'Twin / King Convertible',
        'Partial Ocean View',
        'En-suite Bathroom',
        'Mini Bar',
        'High-speed Wi-Fi',
        'Lounge Seating',
      ],
      description:
        'Bright and airy coastal room with gentle breezes and modern minimalist beach-house aesthetics.',
      imageUrls: [
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'AVAILABLE' as const,
    },
    {
      roomNumber: 'V-105',
      name: 'Palms Sanctuary Suite',
      maxOccupancy: 4,
      basePrice: 350.0,
      amenities: [
        '2 Queen Beds',
        'Courtyard View',
        'Living Area',
        'Family Friendly',
        'Kitchenette',
        'High-speed Wi-Fi',
        'Coffee Maker',
      ],
      description:
        'Spacious family suite with dual queen beds, living nook, and direct access to the central villa courtyard.',
      imageUrls: [
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'MAINTENANCE' as const,
    },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: {
        name: room.name,
        maxOccupancy: room.maxOccupancy,
        basePrice: room.basePrice,
        amenities: room.amenities,
        description: room.description,
        imageUrls: room.imageUrls,
        status: room.status,
      },
      create: {
        roomNumber: room.roomNumber,
        name: room.name,
        maxOccupancy: room.maxOccupancy,
        basePrice: room.basePrice,
        amenities: room.amenities,
        description: room.description,
        imageUrls: room.imageUrls,
        status: room.status,
      },
    });
  }

  console.log('✅ Seeded 5 Villa Inlet rooms successfully into PostgreSQL database!');

  // Seed Initial Bookings
  console.log('Seeding initial bookings...');
  const dbRooms = await prisma.room.findMany();
  const roomMap = new Map(dbRooms.map((r) => [r.roomNumber, r.id]));

  const now = new Date();
  const addDays = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    res.setHours(14, 0, 0, 0); // Check-in at 2:00 PM
    return res;
  };
  const addDaysCheckOut = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    res.setHours(11, 0, 0, 0); // Check-out at 11:00 AM
    return res;
  };

  const sampleBookings = [
    {
      roomNumber: 'V-101',
      guestName: 'Sophia Montgomery',
      guestEmail: 'sophia.montgomery@example.com',
      guestPhone: '+1 (415) 890-1234',
      checkIn: addDays(now, -2),
      checkOut: addDaysCheckOut(now, 3),
      numGuests: 2,
      totalAmount: 2250.0,
      amountPaid: 2250.0,
      status: 'CONFIRMED' as const,
      source: 'DIRECT' as const,
      notes: 'VIP Anniversary couple. Chilled champagne on arrival requested.',
    },
    {
      roomNumber: 'V-101',
      guestName: 'Jonathan & Claire Vance',
      guestEmail: 'jvance@globaladvisors.com',
      guestPhone: '+44 20 7946 0912',
      checkIn: addDays(now, 5),
      checkOut: addDaysCheckOut(now, 9),
      numGuests: 2,
      totalAmount: 1800.0,
      amountPaid: 900.0,
      status: 'CONFIRMED' as const,
      source: 'AIRBNB' as const,
      notes: 'Late arrival expected at 9 PM. Airport transfer arranged.',
    },
    {
      roomNumber: 'V-102',
      guestName: 'Marcus Sterling',
      guestEmail: 'm.sterling@techventure.io',
      guestPhone: '+1 (310) 555-8910',
      checkIn: addDays(now, -1),
      checkOut: addDaysCheckOut(now, 2),
      numGuests: 1,
      totalAmount: 1140.0,
      amountPaid: 1140.0,
      status: 'CONFIRMED' as const,
      source: 'BOOKING_COM' as const,
      notes: 'High-speed Wi-Fi essential for remote executive conferences.',
    },
    {
      roomNumber: 'V-103',
      guestName: 'Dr. Emily Watson',
      guestEmail: 'ewatson@oxford.ac.uk',
      guestPhone: '+44 1865 270000',
      checkIn: addDays(now, -4),
      checkOut: addDaysCheckOut(now, -1),
      numGuests: 2,
      totalAmount: 960.0,
      amountPaid: 960.0,
      status: 'COMPLETED' as const,
      source: 'DIRECT' as const,
      notes: 'Botanical garden enthusiast. Left a 5-star review.',
      checkedOutAt: addDaysCheckOut(now, -1),
    },
    {
      roomNumber: 'V-104',
      guestName: 'David & Mei Chen',
      guestEmail: 'david.chen@pacificventures.sg',
      guestPhone: '+65 6789 0123',
      checkIn: addDays(now, 1),
      checkOut: addDaysCheckOut(now, 4),
      numGuests: 2,
      totalAmount: 870.0,
      amountPaid: 870.0,
      status: 'CONFIRMED' as const,
      source: 'DIRECT' as const,
      notes: 'Honeymoon stay. Requested floral arrangement in room.',
    },
    {
      roomNumber: 'V-105',
      guestName: 'Isabella Laurent Family',
      guestEmail: 'isabella.laurent@paris-studio.fr',
      guestPhone: '+33 1 42 68 55 00',
      checkIn: addDays(now, 4),
      checkOut: addDaysCheckOut(now, 9),
      numGuests: 4,
      totalAmount: 1750.0,
      amountPaid: 500.0,
      status: 'PENDING' as const,
      source: 'OTHER' as const,
      notes: 'Awaiting balance payment receipt before final confirmation.',
    },
  ];

  for (const b of sampleBookings) {
    const roomId = roomMap.get(b.roomNumber);
    if (!roomId) continue;

    // Check if booking already exists for this guest
    const existing = await prisma.booking.findFirst({
      where: {
        roomId,
        guestEmail: b.guestEmail,
        checkIn: b.checkIn,
      },
    });

    if (!existing) {
      await prisma.booking.create({
        data: {
          roomId,
          guestName: b.guestName,
          guestEmail: b.guestEmail,
          guestPhone: b.guestPhone,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          numGuests: b.numGuests,
          totalAmount: b.totalAmount,
          amountPaid: b.amountPaid,
          status: b.status,
          source: b.source,
          notes: b.notes,
          checkedOutAt: b.checkedOutAt,
        },
      });
    }
  }

  console.log('✅ Seeded initial bookings successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
