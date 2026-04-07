import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Mock Data Store
  let tickets = [
    { id: '1', title: 'Lỗi máy in tầng 2', description: 'Máy in không nhận lệnh in từ máy tính.', status: 'open', priority: 'high', category: 'Hardware', createdAt: new Date().toISOString(), requester: 'Nguyễn Văn A', assignedTo: 'IT Support 1' },
    { id: '2', title: 'Cài đặt phần mềm Adobe', description: 'Cần cài đặt Photoshop cho nhân viên mới.', status: 'in-progress', priority: 'medium', category: 'Software', createdAt: new Date().toISOString(), requester: 'Trần Thị B', assignedTo: 'IT Support 2' },
    { id: '3', title: 'Quên mật khẩu email', description: 'Nhân viên không đăng nhập được vào Outlook.', status: 'closed', priority: 'low', category: 'Account', createdAt: new Date().toISOString(), requester: 'Lê Văn C', assignedTo: 'IT Support 1' },
  ];

  let assets = [
    { id: 'a1', name: 'MacBook Pro 14"', type: 'Laptop', serial: 'MBP2023-001', status: 'deployed', assignedTo: 'Nguyễn Văn A', purchaseDate: '2023-05-15', facility: 'Cơ sở Quận 1', imageUrl: 'https://picsum.photos/seed/laptop/400/300' },
    { id: 'a2', name: 'Dell UltraSharp 27"', type: 'Monitor', serial: 'DELL-U27-992', status: 'in-stock', assignedTo: '', purchaseDate: '2023-08-20', facility: 'Cơ sở Quận 7', imageUrl: 'https://picsum.photos/seed/monitor/400/300' },
    { id: 'a3', name: 'Logitech MX Master 3S', type: 'Peripheral', serial: 'LOGI-MX-112', status: 'deployed', assignedTo: 'Trần Thị B', purchaseDate: '2024-01-10', facility: 'Cơ sở Quận 1', imageUrl: 'https://picsum.photos/seed/mouse/400/300' },
  ];

  let facilities = [
    { id: 'f1', name: 'Cơ sở Quận 1' },
    { id: 'f2', name: 'Cơ sở Quận 7' },
    { id: 'f3', name: 'Cơ sở Đà Nẵng' },
    { id: 'f4', name: 'Cơ sở Hà Nội' },
  ];

  // API Routes
  app.get('/api/facilities', (req, res) => res.json(facilities));
  app.post('/api/facilities', (req, res) => {
    const newFacility = { id: uuidv4(), ...req.body };
    facilities.push(newFacility);
    res.status(201).json(newFacility);
  });
  app.patch('/api/facilities/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const oldName = facilities.find(f => f.id === id)?.name;
    facilities = facilities.map(f => f.id === id ? { ...f, name } : f);
    // Update assets that were using the old facility name
    if (oldName) {
      assets = assets.map(a => a.facility === oldName ? { ...a, facility: name } : a);
    }
    res.json(facilities.find(f => f.id === id));
  });
  app.delete('/api/facilities/:id', (req, res) => {
    const { id } = req.params;
    facilities = facilities.filter(f => f.id === id);
    res.status(204).send();
  });
  app.get('/api/tickets', (req, res) => res.json(tickets));
  app.post('/api/tickets', (req, res) => {
    const newTicket = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
    tickets.push(newTicket);
    res.status(201).json(newTicket);
  });
  app.patch('/api/tickets/:id', (req, res) => {
    const { id } = req.params;
    tickets = tickets.map(t => t.id === id ? { ...t, ...req.body } : t);
    res.json(tickets.find(t => t.id === id));
  });

  app.get('/api/assets', (req, res) => res.json(assets));
  app.post('/api/assets', (req, res) => {
    const newAsset = { id: uuidv4(), ...req.body };
    assets.push(newAsset);
    res.status(201).json(newAsset);
  });

  app.get('/api/stats', (req, res) => {
    const stats = {
      totalTickets: tickets.length,
      openTickets: tickets.filter(t => t.status === 'open').length,
      closedTickets: tickets.filter(t => t.status === 'closed').length,
      totalAssets: assets.length,
      assetsByStatus: {
        deployed: assets.filter(a => a.status === 'deployed').length,
        inStock: assets.filter(a => a.status === 'in-stock').length,
        maintenance: assets.filter(a => a.status === 'maintenance').length,
      }
    };
    res.json(stats);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
