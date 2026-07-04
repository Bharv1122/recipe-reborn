import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/shopping-lists - Get all shopping lists for the user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shoppingLists = await prisma.shoppingList.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: [
            { checked: 'asc' },
            { category: 'asc' },
            { order: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(shoppingLists);
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping lists' },
      { status: 500 }
    );
  }
}

// POST /api/shopping-lists - Create a new shopping list
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, notes } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId: session.user.id,
        name,
        notes,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(shoppingList, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping list' },
      { status: 500 }
    );
  }
}