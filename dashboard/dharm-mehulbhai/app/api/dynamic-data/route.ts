import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'dynamic_data.json');

// Helper to read data
const readData = () => {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      // Create default if not exists
      const defaultData = {
        industries: [],
        brands: {},
        chemicals: {},
        countries: [],
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading dynamic data:', error);
    return {
      industries: [],
      brands: {},
      chemicals: {},
      countries: [],
      lastUpdated: new Date().toISOString()
    };
  }
};

// Helper to write data
const writeData = (data: any) => {
  try {
    const dirPath = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing dynamic data:', error);
    return false;
  }
};

export async function GET() {
  const data = readData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation could go here
    
    const success = writeData(body);
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Data saved successfully' });
    } else {
      return NextResponse.json({ success: false, message: 'Failed to save data' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing POST request:', error);
    return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
  }
}
