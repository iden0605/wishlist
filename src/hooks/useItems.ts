import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, type OrderByDirection } from 'firebase/firestore';
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

export const useItems = (sortBy: SortByType) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const itemsCollection = collection(db, 'items');
    
    const q = query(itemsCollection, orderBy(sortBy.field, sortBy.direction));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const itemsData: Item[] = [];
      querySnapshot.forEach((doc) => {
        itemsData.push({ ...doc.data(), id: doc.id } as Item);
      });
      setItems(itemsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sortBy]);

  return { items, loading };
};