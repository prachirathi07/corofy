import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');

    console.log('📦 Fetching products with params:', { industry });

    let products;

    if (industry) {
      products = await ProductDatabase.getProductsByIndustry(industry);
    } else {
      products = await ProductDatabase.getAllProducts();
    }

    console.log('✅ Products fetched:', products.length);
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();
    console.log('📝 Creating new product:', productData);

    const newProduct = await ProductDatabase.insertProduct(productData);
    console.log('✅ Product created:', newProduct?.id);
    
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();
    console.log('🔄 Updating product:', id, updates);

    const updatedProduct = await ProductDatabase.updateProduct(id, updates);
    console.log('✅ Product updated:', updatedProduct?.id);
    
    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('❌ Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting product:', id);
    await ProductDatabase.deleteProduct(id);
    console.log('✅ Product deleted:', id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}






