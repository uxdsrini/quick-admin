import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, doc, updateDoc, addDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { ShoppingCart, Clock, CheckCircle, XCircle, Package } from 'lucide-react';

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [storeNames, setStoreNames] = useState<{ [storeId: string]: string }>({});
  const previousOrdersRef = useRef<Set<string>>(new Set());

  // Helper function to fetch store name by storeId
  const fetchStoreName = async (storeId: string) => {
    try {
      const storeRef = doc(db, 'stores', storeId);
      const storeSnapshot = await getDoc(storeRef);
      if (storeSnapshot.exists()) {
        const storeName = storeSnapshot.data().name;
        setStoreNames(prev => ({ ...prev, [storeId]: storeName }));
        return storeName;
      }
    } catch (error) {
      console.error('Error fetching store name:', error);
    }
    return null;
  };

  // Helper function to save notification to Firebase
  const saveNotification = async (order: Order, type: 'new_order' | 'status_update' | 'payment_update', message: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        type,
        message,
        read: false,
        createdAt: new Date().toISOString()
      });
      console.log('Notification saved:', type, order.orderNumber);
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Fetch store names for all orders
      const uniqueStoreIds = new Set(ordersData.map(order => order.storeId));
      for (const storeId of uniqueStoreIds) {
        if (storeId && !storeNames[storeId]) {
          await fetchStoreName(storeId);
        }
      }
      
      // Track new orders (those added after initial load)
      if (!loading) {
        querySnapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const order = { id: change.doc.id, ...change.doc.data() } as Order;
            
            // Fetch store name for new order
            if (order.storeId && !storeNames[order.storeId]) {
              await fetchStoreName(order.storeId);
            }
            
            // Check if this is truly a new order (not from initial load)
            if (!previousOrdersRef.current.has(change.doc.id)) {
              setNewOrderIds(prev => new Set(prev).add(change.doc.id));
              
              // Save notification to Firebase for new order
              await saveNotification(
                order,
                'new_order',
                `New order received from ${order.customerName} - ₹${order.totalAmount}`
              );
              
              // Remove the "new" badge after 5 seconds
              setTimeout(() => {
                setNewOrderIds(prev => {
                  const updated = new Set(prev);
                  updated.delete(change.doc.id);
                  return updated;
                });
              }, 5000);
            }
          }
        });
      }
      
      // Update previous orders set
      previousOrdersRef.current = new Set(ordersData.map(order => order.id));
      
      setOrders(ordersData);
      setLoading(false);
      console.log('Orders refreshed at:', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, storeNames]);

  useEffect(() => {
    // Initial fetch
    fetchOrders();

    // Set up auto-refresh every 1 minute (60000 milliseconds)
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  // Show last refresh time
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    setLastRefresh(new Date());
  }, [orders]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'confirmed':
      case 'processing':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'completed':
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'confirmed':
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentStatusBadgeClass = (paymentStatus: string) => {
    switch (paymentStatus.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Update delivery status in Firebase
  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingStatus(orderId);
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus
      });
      console.log(`Order ${orderId} delivery status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('Failed to update delivery status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Update payment status in Firebase
  const updatePaymentStatus = async (orderId: string, newPaymentStatus: string) => {
    try {
      setUpdatingStatus(orderId);
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        paymentStatus: newPaymentStatus
      });
      console.log(`Order ${orderId} payment status updated to ${newPaymentStatus}`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Now
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No orders yet. Orders will appear here in real-time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`border rounded-lg p-4 hover:shadow-md transition ${
                newOrderIds.has(order.id) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{order.orderNumber}</h3>
                    {newOrderIds.has(order.id) && (
                      <span className="px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{order.customerName}</span> • {order.customerPhone}
                  </p>
                  {storeNames[order.storeId] && (
                    <p className="text-sm text-emerald-600 font-medium mt-1">
                      Store: {storeNames[order.storeId]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    <select
                      value={order.status}
                      onChange={(e) => updateDeliveryStatus(order.id, e.target.value)}
                      disabled={updatingStatus === order.id}
                      className={`px-3 py-1 text-xs font-medium rounded border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${getStatusBadgeClass(order.status)} ${
                        updatingStatus === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Delivery:</span> {order.deliveryAddress}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Payment Method:</span> {order.paymentMethod}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Order Time:</span> {formatDate(order.createdAt)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-gray-600">Payment:</span>
                    <select
                      value={order.paymentStatus}
                      onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                      disabled={updatingStatus === order.id}
                      className={`px-2 py-1 text-xs font-medium rounded border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${getPaymentStatusBadgeClass(order.paymentStatus)} ${
                        updatingStatus === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Items ({order.items?.length || 0})
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="text-gray-900 font-medium">₹{item.totalPrice}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <span>Subtotal: ₹{order.subtotal}</span>
                    {order.deliveryFee > 0 && <span className="ml-3">Delivery: ₹{order.deliveryFee}</span>}
                    {order.discountAmount > 0 && <span className="ml-3">Discount: -₹{order.discountAmount}</span>}
                  </div>
                  <span className="text-lg font-bold text-gray-900">₹{order.totalAmount}</span>
                </div>
              </div>

              {order.notes && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  <span className="font-medium">Note:</span> {order.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
