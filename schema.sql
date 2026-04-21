-- Loomra Atelier - Final Production SQL Schema
-- Run this in the Firebase SQL Editor (or similar)

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  img TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  video_url TEXT,
  colors JSONB DEFAULT '[]',
  seo JSONB DEFAULT '{}',
  seo_score INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  size_stock JSONB DEFAULT '{"S": 0, "M": 0, "L": 0, "XL": 0}',
  sku TEXT UNIQUE,
  status TEXT DEFAULT 'Active',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'Unfulfilled',
  timeline JSONB DEFAULT '[]',
  payment_method TEXT DEFAULT 'Cash on Delivery',
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. System Configs Table (For API Keys)
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Marketing Hero Table
CREATE TABLE IF NOT EXISTS marketing_hero (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Initial Data Insert (Dummy Rows for Setup)
INSERT INTO system_configs (key_name, value, description)
VALUES 
  ('GEMINI_API_KEY', 'DUMMY_KEY', 'Google Gemini API Key for AI Support'),
  ('VITE_FIREBASE_API_KEY', 'DUMMY_KEY', 'Firebase API Key'),
  ('VITE_FIREBASE_PROJECT_ID', 'DUMMY_ID', 'Firebase Project ID')
ON CONFLICT (key_name) DO NOTHING;

-- 6. Initial Marketing Data
INSERT INTO marketing_hero (image_url, display_order)
VALUES 
  ('https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=1920', 1),
  ('https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=1920', 2)
ON CONFLICT DO NOTHING;

-- Enable RLS (Optional but recommended)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_hero ENABLE ROW LEVEL SECURITY;

-- Create Policies (Public Read for products/marketing, Authenticated for others)
CREATE POLICY "Public Read Products" ON products FOR SELECT USING (true);
CREATE POLICY "Public Read Marketing" ON marketing_hero FOR SELECT USING (true);
CREATE POLICY "Authenticated All Orders" ON orders FOR ALL USING (true); -- Adjust for production
CREATE POLICY "Authenticated All Configs" ON system_configs FOR ALL USING (true); -- Adjust for production
