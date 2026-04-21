import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mock Orders for the API
  const MOCK_ORDERS_DB: Record<string, any> = {
    'LR-1234': {
      id: 'LR-1234',
      customerName: 'Ahmed Khan',
      status: 'Pending',
      totalAmount: 1850,
      date: '2024-03-28T10:30:00Z',
      city: 'Karachi',
      paymentMethod: 'COD'
    },
    'LR-5678': {
      id: 'LR-5678',
      customerName: 'Sara Ali',
      status: 'Packed',
      totalAmount: 5700,
      date: '2024-03-27T14:20:00Z',
      city: 'Lahore',
      paymentMethod: 'COD'
    }
  };

  // API routes
  app.get("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    const order = MOCK_ORDERS_DB[orderId];
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
