import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Edit2, Trash2, Store as StoreIcon, Search, X } from 'lucide-react';
import { VENDOR_CATEGORIES } from '../constants/categories';
import { Store } from '../types';

type VendorCategory = typeof VENDOR_CATEGORIES[number];

export default function StoreManagement() {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Store[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadStores = async () => {
    try {
      const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const storesData = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as Store[];
      setStores(storesData);
      setFilteredStores(storesData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading stores:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStores(stores);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = stores.filter(store =>
      store.name.toLowerCase().includes(query) ||
      store.category.toLowerCase().includes(query) ||
      store.address.toLowerCase().includes(query) ||
      store.phone.includes(query)
    );

    setFilteredStores(filtered);
    setSuggestions(filtered.slice(0, 5)); // Show top 5 suggestions
  }, [searchQuery, stores]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (store: Store) => {
    setSearchQuery(store.name);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredStores(stores);
    setShowSuggestions(false);
  };

  const handleSaveStore = async (storeData: Omit<Store, 'id'>) => {
    try {
      if (editingStore) {
        await updateDoc(doc(db, 'stores', editingStore.id), storeData);
      } else {
        await addDoc(collection(db, 'stores'), {
          ...storeData,
          createdAt: new Date().toISOString()
        });
      }
      loadStores();
      setIsModalOpen(false);
      setEditingStore(null);
    } catch (error) {
      console.error('Error saving store:', error);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (window.confirm('Are you sure you want to delete this store?')) {
      try {
        await deleteDoc(doc(db, 'stores', storeId));
        loadStores();
      } catch (error) {
        console.error('Error deleting store:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Store Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Total Stores: {filteredStores.length} {stores.length !== filteredStores.length && `of ${stores.length}`}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingStore(null);
            setIsModalOpen(true);
          }}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-teal-700 whitespace-nowrap"
        >
          <Plus size={20} />
          Add Store
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div ref={searchRef} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchQuery && setShowSuggestions(true)}
            placeholder="Search by store name, category, address, or phone..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
              {suggestions.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleSuggestionClick(store)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0 transition"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded overflow-hidden">
                    {store.image ? (
                      <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
                        <StoreIcon className="w-6 h-6 text-teal-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{store.name}</p>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                        store.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {store.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-teal-600 mb-0.5">{store.category}</p>
                    <p className="text-xs text-gray-500 truncate">{store.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found <span className="font-semibold text-gray-900">{filteredStores.length}</span> store{filteredStores.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </p>
            <button
              onClick={clearSearch}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1.5 hover:bg-emerald-50 px-3 py-1.5 rounded-md transition"
            >
              <X className="w-4 h-4" />
              Clear search
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading stores...</p>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No stores match your search' : 'No stores yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchQuery ? 'Try adjusting your search terms' : 'Add your first store to get started'}
          </p>
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <X className="w-4 h-4" />
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div key={store.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
              {/* Store Image */}
              <div className="relative h-36 bg-gray-200">
                {store.image ? (
                  <img
                    src={store.image}
                    alt={store.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-100 to-teal-200">
                    <StoreIcon className="text-teal-400" size={48} />
                  </div>
                )}
                {/* Active Badge */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      store.isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {store.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Store Info */}
              <div className="p-4">
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{store.name}</h3>
                  <span className="inline-block px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded-full">
                    {store.category}
                  </span>
                </div>

                {store.description && (
                  <p className="text-gray-600 text-xs mb-3 line-clamp-2">{store.description}</p>
                )}

                <div className="space-y-1 text-xs text-gray-600 mb-3">
                  <p className="flex items-start">
                    <span className="mr-1">📍</span>
                    <span className="line-clamp-1">{store.address}</span>
                  </p>
                  <p className="flex items-center">
                    <span className="mr-1">📞</span>
                    <span>{store.phone}</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setEditingStore(store);
                      setIsModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                  >
                    <Edit2 size={14} />
                    <span className="font-medium">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteStore(store.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm"
                  >
                    <Trash2 size={14} />
                    <span className="font-medium">Delete</span>
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
          onSave={handleSaveStore}
          onClose={() => {
            setIsModalOpen(false);
            setEditingStore(null);
          }}
        />
      )}
    </div>
  );
}

interface StoreModalProps {
  store: Store | null;
  onSave: (storeData: Omit<Store, 'id'>) => Promise<void>;
  onClose: () => void;
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
      <div className="absolute inset-0 bg-black opacity-30" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full z-10 max-h-[90vh] overflow-y-auto">
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
