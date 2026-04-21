# Instructions to Add "Loomra Signature Tee" to Firestore

Since the Firebase Admin SDK credentials aren't available in this environment, please add the product manually using one of these methods:

## Option 1: Firebase Console (Recommended for Testing)

1. Go to: https://console.firebase.google.com/project/loomra-60cd7/firestore/data
2. Click "Start collection"
3. Collection ID: `products`
4. Click "Auto-ID" to generate document ID
5. Add fields following the Version 2.0.0 schema:

```json
{
  "title": "Loomra Signature Tee",
  "name": "Loomra Signature Tee",
  "description": "Premium heavyweight cotton tee with signature Loomra embroidery. Features relaxed oversized fit with dropped shoulders.",
  "price": 2850,
  "oldPrice": 3500,
  "category": "TEES",
  "status": "Active",
  "stock": 45,
  "sizeStock": {
    "S": 10,
    "M": 15,
    "L": 12,
    "XL": 8
  },
  "sku": "LR-TEE-SIG-001",
  "seo": {
    "title": "Loomra Signature Tee | Luxury Streetwear",
    "description": "Premium heavyweight cotton tee with signature Loomra embroidery"
  },
  "seoScore": 92,
  "tags": ["tee", "signature", "streetwear", "oversized"],
  "is_active": true,
  "colors": [
    {
      "name": "Onyx Black",
      "hex": "#000000",
      "active": true,
      "images": [
        "https://picsum.photos/seed/tee-black1/800/1000",
        "https://picsum.photos/seed/tee-black2/800/1000",
        "https://picsum.photos/seed/tee-black3/800/1000",
        "https://picsum.photos/seed/tee-black4/800/1000",
        "https://picsum.photos/seed/tee-black5/800/1000"
      ]
    },
    {
      "name": "Crimson Red",
      "hex": "#b30400",
      "active": true,
      "images": [
        "https://picsum.photos/seed/tee-red1/800/1000",
        "https://picsum.photos/seed/tee-red2/800/1000",
        "https://picsum.photos/seed/tee-red3/800/1000",
        "https://picsum.photos/seed/tee-red4/800/1000",
        "https://picsum.photos/seed/tee-red5/800/1000"
      ]
    },
    {
      "name": "Pure White",
      "hex": "#FFFFFF",
      "active": true,
      "images": [
        "https://picsum.photos/seed/tee-white1/800/1000",
        "https://picsum.photos/seed/tee-white2/800/1000",
        "https://picsum.photos/seed/tee-white3/800/1000",
        "https://picsum.photos/seed/tee-white4/800/1000",
        "https://picsum.photos/seed/tee-white5/800/1000"
      ]
    }
  ],
  "imageUrl": "https://picsum.photos/seed/tee-black1/800/1000",
  "img": "https://picsum.photos/seed/tee-black1/800/1000",
  "images": ["https://picsum.photos/seed/tee-black1/800/1000"],
  "created_at": "2026-04-12T12:00:00.000Z",
  "_migrated": true,
  "_migrationVersion": "2.0.0"
}
```

6. Click "Save"

## Option 2: Run seed script locally

```bash
# Install firebase-admin
npm install firebase-admin

# Create seed script
cat > seed.cjs << 'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

db.collection('products').add({
  title: "Loomra Signature Tee",
  name: "Loomra Signature Tee",
  // ... rest of product data
}).then(doc => console.log('Product added:', doc.id));
EOF

node seed.cjs
```

## Option 3: Use Loomra Admin Panel

1. Navigate to your Loomra storefront
2. Login as admin (tahirshah45@gmail.com)
3. Go to Admin Panel
4. Click "Add Product"
5. Fill in the form with the data above
6. Save

## Verification Steps

1. Check Firebase Console - document should appear in `products` collection
2. Open storefront - product should appear in shop
3. Click product - should show Onyx Black by default
4. Click Crimson Red - gallery images should update
5. Check console for "Firestore Products Loaded" log message