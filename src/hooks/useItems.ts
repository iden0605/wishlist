import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, type OrderByDirection, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Price } from '@/lib/currency';

export interface Item {
  id: string;
  title: string;
  image: string;
  price: Price;
  link: string;
  remarks?: string;
  favorite?: boolean;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export type SortByType = {
  field: string;
  direction: OrderByDirection;
};

// Optimized version with limit and error handling
export const useItems = (sortBy: SortByType, limitCount = 50, showFavorites = false) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemsCollection = collection(db, 'items');
    
    const queryConstraints: QueryConstraint[] = [];

    if (showFavorites) {
      queryConstraints.push(where('favorite', '==', true));
    }

    queryConstraints.push(orderBy(sortBy.field, sortBy.direction));
    queryConstraints.push(limit(limitCount));
    
    const q = query(itemsCollection, ...queryConstraints);

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const itemsData = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Item));
        setItems(itemsData);
        setLoading(false);
      }, 
      (error) => {
        console.error("Error fetching items:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sortBy.field, sortBy.direction, limitCount, showFavorites]); // Depend on primitives

  return { items, loading };
};