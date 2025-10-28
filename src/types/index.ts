export interface Store {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  image: string;
  category: string;
  rating: number;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  inStock: boolean;
  createdAt: string;
}

export interface User {
  uid: string;
  email: string;
  role: 'admin';
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryFee: number;
  discountAmount: number;
  items: OrderItem[];
  notes: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  storeId: string;
  subtotal: number;
  totalAmount: number;
  userId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  type: 'new_order' | 'status_update' | 'payment_update';
  message: string;
  read: boolean;
  createdAt: string;
}
