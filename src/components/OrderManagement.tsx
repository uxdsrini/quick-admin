import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, doc, updateDoc, addDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { ShoppingCart, Clock, CheckCircle, XCircle, Package, CreditCard, Search, X, Filter } from 'lucide-react';

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null);
  const [storeNames, setStoreNames] = useState<{ [storeId: string]: string }>({});
  const previousOrdersRef = useRef<Set<string>>(new Set());
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Order[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const searchRef = useRef<HTMLDivElement>(null);

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

  const loadOrders = useCallback(async () => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      const currentOrderIds = new Set(ordersData.map(order => order.id));
      const newIds = new Set<string>();

      ordersData.forEach(order => {
        if (!previousOrdersRef.current.has(order.id)) {
          newIds.add(order.id);
          if (previousOrdersRef.current.size > 0) {
            saveNotification(order, 'new_order', `New order #${order.orderNumber} received`);
          }
        }
        if (order.storeId && !storeNames[order.storeId]) {
          fetchStoreName(order.storeId);
        }
      });

      if (newIds.size > 0) {
        setNewOrderIds(newIds);
        setTimeout(() => setNewOrderIds(new Set()), 5000);
      }

      previousOrdersRef.current = currentOrderIds;
      setOrders(ordersData);
      setFilteredOrders(ordersData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading orders:', error);
      setLoading(false);
    }
  }, [storeNames]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and search logic
  useEffect(() => {
    let filtered = orders;

    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const storeName = storeNames[order.storeId]?.toLowerCase() || '';
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          storeName.includes(query)
        );
      });
      
      // Update suggestions (top 5 matches)
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }

    // Apply order status filter
    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatusFilter);
    }

    // Apply payment status filter
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    setFilteredOrders(filtered);
  }, [searchQuery, orderStatusFilter, paymentStatusFilter, orders, storeNames]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (order: Order) => {
    setSearchQuery(order.orderNumber);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setOrderStatusFilter('all');
    setPaymentStatusFilter('all');
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      const updatedOrder = orders.find(o => o.id === orderId);
      if (updatedOrder) {
        saveNotification(updatedOrder, 'status_update', `Order #${updatedOrder.orderNumber} status updated to ${newStatus}`);
      }
      await loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePaymentStatusUpdate = async (orderId: string, newPaymentStatus: string) => {
    setUpdatingPayment(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus: newPaymentStatus });
      const updatedOrder = orders.find(o => o.id === orderId);
      if (updatedOrder) {
        saveNotification(updatedOrder, 'payment_update', `Order #${updatedOrder.orderNumber} payment status updated to ${newPaymentStatus}`);
      }
      await loadOrders();
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      setUpdatingPayment(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-500" size={20} />;
      case 'confirmed':
        return <CheckCircle className="text-blue-500" size={20} />;
      case 'preparing':
        return <Package className="text-purple-500" size={20} />;
      case 'ready':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'completed':
        return <CheckCircle className="text-teal-500" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <ShoppingCart size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-purple-100 text-purple-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-teal-100 text-teal-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const hasActiveFilters = searchQuery !== '' || orderStatusFilter !== 'all' || paymentStatusFilter !== 'all';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Order Management</h2>
        <div className="text-sm text-gray-600">
          Total Orders: {filteredOrders.length} {orders.length !== filteredOrders.length && `of ${orders.length}`}
        </div>
      </div>

      {/* Search and Filters - Cleaner Layout */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Search Bar - Takes more space */}
          <div ref={searchRef} className="relative lg:col-span-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              placeholder="Search by order number, customer name, or store..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                {suggestions.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleSuggestionClick(order)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(order.status)}
                        <span className="font-semibold text-sm">#{order.orderNumber}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{order.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{storeNames[order.storeId]}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-emerald-600 mb-1">₹{order.totalAmount.toFixed(2)}</p>
                      <div className="flex gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Order Status Filter */}
          <div className="lg:col-span-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Payment Status Filter */}
          <div className="lg:col-span-3">
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none bg-white"
              >
                <option value="all">All Payments</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredOrders.length}</span> of <span className="font-semibold text-gray-900">{orders.length}</span> orders
            </p>
            <button
              onClick={clearAllFilters}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1.5 hover:bg-emerald-50 px-3 py-1.5 rounded-md transition"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {hasActiveFilters ? 'No orders match your filters' : 'No orders yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {hasActiveFilters ? 'Try adjusting your search or filters' : 'Orders will appear here once customers place them'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <X className="w-4 h-4" />
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-5 transition-all hover:shadow-md ${
                newOrderIds.has(order.id) ? 'ring-2 ring-emerald-500 shadow-emerald-100' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(order.status)}
                    <h3 className="font-semibold text-lg">Order #{order.orderNumber}</h3>
                    {newOrderIds.has(order.id) && (
                      <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-medium animate-pulse">NEW</span>
                    )}
                  </div>
                  <p className="text-gray-700 font-medium">{order.customerName}</p>
                  <p className="text-sm text-gray-500">{order.storeId && storeNames[order.storeId]}</p>
                  <p className="text-sm text-gray-500">Payment: <span className="font-medium">{order.paymentMethod}</span></p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl font-bold text-emerald-600">₹{order.totalAmount.toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(order.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Order Items:</h4>
                <ul className="space-y-1.5">
                  {order.items.map((item, index) => (
                    <li key={index} className="text-sm flex justify-between items-center">
                      <span className="text-gray-700">
                        {item.productName} <span className="text-gray-500">× {item.quantity}</span>
                      </span>
                      <span className="font-medium text-gray-900">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Order Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Order Status</label>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusColor(order.status)} flex-shrink-0`}>
                      {order.status.toUpperCase()}
                    </span>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                      disabled={updatingStatus === order.id}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Payment Status</label>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getPaymentStatusColor(order.paymentStatus)} flex-shrink-0`}>
                      {order.paymentStatus.toUpperCase()}
                    </span>
                    <select
                      value={order.paymentStatus}
                      onChange={(e) => handlePaymentStatusUpdate(order.id, e.target.value)}
                      disabled={updatingPayment === order.id}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
