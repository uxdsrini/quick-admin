import { db } from '../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { VENDOR_CATEGORIES } from '../constants/categories';

export async function migrateCategories() {
  try {
    const batch = writeBatch(db);
    const storesRef = collection(db, 'stores');
    const snapshot = await getDocs(storesRef);
    
    let updateCount = 0;
    snapshot.docs.forEach((doc) => {
      const store = doc.data();
      if (!VENDOR_CATEGORIES.includes(store.category)) {
        batch.update(doc.ref, {
          category: VENDOR_CATEGORIES[0], // Default to first category if invalid
          updatedAt: new Date().toISOString()
        });
        updateCount++;
      }
    });

    await batch.commit();
    console.log(`Successfully updated ${updateCount} stores with new categories`);
  } catch (error) {
    console.error('Error migrating categories:', error);
    throw error;
  }
}