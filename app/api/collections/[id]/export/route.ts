import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const dynamic = 'force-dynamic';

// POST /api/collections/[id]/export - Export collection as PDF cookbook
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch collection with recipes
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        collectionRecipes: {
          include: {
            recipe: true,
          },
          orderBy: { order: 'asc' },
        },
        user: {
          select: { name: true },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.collectionRecipes.length === 0) {
      return NextResponse.json(
        { error: 'Collection is empty' },
        { status: 400 }
      );
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title Page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(collection.name, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;
    
    if (collection.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(collection.description, pageWidth - 40);
      doc.text(descLines, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += descLines.length * 6;
    }

    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Created by ${collection.user.name || 'RecipeReborn User'}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    
    yPosition += 5;
    doc.text(
      `${collection.collectionRecipes.length} Recipes`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );

    yPosition += 15;
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);

    // Table of Contents
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    collection.collectionRecipes.forEach((cr: any, index: number) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(`${index + 1}. ${cr.recipe.title}`, 25, yPosition);
      yPosition += 7;
    });

    // Recipe Pages
    collection.collectionRecipes.forEach((cr: any, index: number) => {
      const recipe = cr.recipe;
      doc.addPage();
      yPosition = 20;

      // Recipe Number and Title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Recipe ${index + 1} of ${collection.collectionRecipes.length}`, 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(recipe.title, pageWidth - 40);
      doc.text(titleLines, 20, yPosition);
      yPosition += titleLines.length * 8;

      // Meta Information
      yPosition += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const metaInfo: string[] = [];
      if (recipe.prepTime) metaInfo.push(`Prep: ${recipe.prepTime}`);
      if (recipe.cookTime) metaInfo.push(`Cook: ${recipe.cookTime}`);
      if (recipe.servings) metaInfo.push(`Servings: ${recipe.servings}`);
      if (metaInfo.length > 0) {
        doc.text(metaInfo.join('  •  '), 20, yPosition);
        yPosition += 7;
      }

      // Dietary Tags
      if (recipe.dietaryTags && recipe.dietaryTags.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.text(`Tags: ${recipe.dietaryTags.join(', ')}`, 20, yPosition);
        yPosition += 7;
      }

      yPosition += 3;
      doc.setLineWidth(0.3);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;

      // Ingredients
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ingredients', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const ingredients = JSON.parse(recipe.freshIngredients);
      ingredients.forEach((ingredient: string) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const bulletPoint = '• ';
        const ingredientLines = doc.splitTextToSize(
          ingredient,
          pageWidth - 50
        );
        doc.text(bulletPoint, 25, yPosition);
        doc.text(ingredientLines, 30, yPosition);
        yPosition += ingredientLines.length * 6;
      });

      yPosition += 5;

      // Instructions
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Instructions', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const instructions = JSON.parse(recipe.instructions);
      instructions.forEach((instruction: string, idx: number) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const stepLabel = `${idx + 1}. `;
        const instructionLines = doc.splitTextToSize(
          instruction,
          pageWidth - 50
        );
        doc.text(stepLabel, 25, yPosition);
        doc.text(instructionLines, 35, yPosition);
        yPosition += instructionLines.length * 6 + 3;
      });

      // Notes
      if (recipe.notes) {
        yPosition += 5;
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes', 20, yPosition);
        yPosition += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        const notesLines = doc.splitTextToSize(recipe.notes, pageWidth - 40);
        doc.text(notesLines, 20, yPosition);
      }
    });

    // Footer on last page
    doc.addPage();
    yPosition = pageHeight / 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.text('Created with RecipeReborn', pageWidth / 2, yPosition, {
      align: 'center',
    });
    yPosition += 7;
    doc.setFontSize(10);
    doc.text('Your AI-powered recipe companion', pageWidth / 2, yPosition, {
      align: 'center',
    });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${collection.name.replace(/[^a-z0-9]/gi, '-')}-cookbook.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
