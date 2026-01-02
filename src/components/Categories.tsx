import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCategories } from '@/hooks/useCategories';

interface CategoriesProps {
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
}

const Categories: React.FC<CategoriesProps> = ({ selectedCategory, setSelectedCategory }) => {
  const { categories, loading } = useCategories();
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim() === '') return;

    await addDoc(collection(db, 'categories'), {
      name: newCategory,
      createdAt: serverTimestamp(),
    });

    setNewCategory('');
  };

  const handleUpdate = async (id: string) => {
    if (!editingCategory || editingCategory.name.trim() === '') return;
    
    const categoryDoc = doc(db, 'categories', id);
    await updateDoc(categoryDoc, { name: editingCategory.name });

    setEditingCategory(null);
  };

  const handleDelete = async (id: string) => {
    const categoryDoc = doc(db, 'categories', id);
    await deleteDoc(categoryDoc);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Categories</h2>
      <div className="mb-4">
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2"
          >
            Add
          </button>
        </form>
      </div>
      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          <li
            onClick={() => setSelectedCategory(null)}
            className={`cursor-pointer p-2 rounded ${!selectedCategory ? 'bg-pink-500 text-white' : 'bg-gray-200'}`}
          >
            All
          </li>
          {categories.map((category) => (
            <li key={category.id} className="flex items-center group">
              <span
                onClick={() => setSelectedCategory(category.id)}
                className={`cursor-pointer p-2 rounded ${selectedCategory === category.id ? 'bg-pink-500 text-white' : 'bg-gray-200'}`}
              >
                {editingCategory?.id === category.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  />
                ) : (
                  category.name
                )}
              </span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {editingCategory?.id === category.id ? (
                  <button onClick={() => handleUpdate(category.id)} className="bg-green-500 text-white p-1 rounded ml-2">Save</button>
                ) : (
                  <button onClick={() => setEditingCategory({ id: category.id, name: category.name })} className="bg-yellow-500 text-white p-1 rounded ml-2">Edit</button>
                )}
                <button onClick={() => handleDelete(category.id)} className="bg-red-500 text-white p-1 rounded ml-2">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Categories;