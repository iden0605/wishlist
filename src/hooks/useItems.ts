import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, type OrderByDirection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Item {
  id: string;
  title: string;
  image: string;
  price: number;
  link: string;
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
export const useItems = (sortBy: SortByType, limitCount = 50) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemsCollection = collection(db, 'items');
    
    const q = query(
      itemsCollection, 
      orderBy(sortBy.field, sortBy.direction),
      limit(limitCount)
    );

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
  }, [sortBy.field, sortBy.direction, limitCount]); // Depend on primitives

  return { items, loading };
};