import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Store } from '../types';
import { Plus, Edit2, Trash2, Store as StoreIcon } from 'lucide-react';
import { VENDOR_CATEGORIES } from '../constants/categories';

type VendorCategory = typeof VENDOR_CATEGORIES[number];

// Removed the direct definition of vendor categories

interface StoreModalProps {
  store: Store | null;
  onSave: (storeData: Omit<Store, 'id'>) => Promise<void>;
  onClose: () => void;
}

export default function StoreManagement() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  // eslint-disable-next-line no-empty-pattern
  const [] = useState<VendorCategory>(VENDOR_CATEGORIES[0]);

  const loadStores = async () => {
    try {
      const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const storesData = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as Store[];
      setStores(storesData);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleAddStore = async (storeData: Omit<Store, 'id'>) => {
    try {
      await addDoc(collection(db, 'stores'), storeData);
      await loadStores();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding store:', error);
    }
  };

  const handleUpdateStore = async (storeData: Omit<Store, 'id'>) => {
    if (!editingStore) return;
    try {
      await updateDoc(doc(db, 'stores', editingStore.id), storeData);
      await loadStores();
      setIsModalOpen(false);
      setEditingStore(null);
    } catch (error) {
      console.error('Error updating store:', error);
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await deleteDoc(doc(db, 'stores', id));
      await loadStores();
    } catch (error) {
      console.error('Error deleting store:', error);
    }
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStore(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Store Management</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Store
        </button>
      </div>

      {stores.length === 0 ? (
        <div className="text-center py-12">
          <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No stores yet. Add your first store to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {store.image ? (
                  <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <StoreIcon className="w-16 h-16 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{store.name}</h3>
                    <div className="category-badge">
                      {store.category}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${store.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {store.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{store.description}</p>
                <p className="text-sm text-gray-500 mb-1">{store.address}</p>
                <p className="text-sm text-gray-500 mb-3">{store.phone}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(store)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStore(store.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <StoreModal
          store={editingStore}
          onSave={editingStore ? handleUpdateStore : handleAddStore}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function StoreModal({ store, onSave, onClose }: StoreModalProps): JSX.Element {
  const [formData, setFormData] = useState<Omit<Store, 'id'>>(store ? { ...store } : {
    name: '',
    description: '',
    address: '',
    phone: '',
    category: VENDOR_CATEGORIES[0],
    image: '',
    rating: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (store) {
      setFormData({ ...store });
    }
  }, [store]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (store) {
      await onSave(formData);
    } else {
      await onSave({ ...formData, createdAt: new Date().toISOString() });
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-30"></div>
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full z-10">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{store ? 'Edit Store' : 'Add Store'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="form-input block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="form-textarea block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              ></textarea>
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="form-input block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="form-input block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="form-select block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              >
                {VENDOR_CATEGORIES.map((category: VendorCategory) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="text"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleChange}
                className="form-input block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="form-checkbox h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              {store ? 'Update Store' : 'Add Store'}
            </button>
          </div>
        </form>
        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
