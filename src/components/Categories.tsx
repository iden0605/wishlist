import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCategories } from '@/hooks/useCategories';

const Categories = () => {
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
    <div className="p-6 mb-8 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-700">Manage Categories</h2>
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="shadow-sm appearance-none border rounded-lg w-full p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button
            type="submit"
            className="flex items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg ml-2 transition-colors duration-300"
          >
            <span className="mr-2">+</span> Add
          </button>
        </form>
      </div>
      {loading ? (
        <p>Loading categories...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center group justify-between p-2 rounded-lg bg-gray-100 border border-gray-200">
              <div>
                {editingCategory?.id === category.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="shadow-sm appearance-none border rounded-lg w-full p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                ) : (
                  <span>{category.name}</span>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                {editingCategory?.id === category.id ? (
                  <button onClick={() => handleUpdate(category.id)} className="bg-green-500 text-white p-2 rounded-lg ml-2">Save</button>
                ) : (
                  <button onClick={() => setEditingCategory({ id: category.id, name: category.name })} className="bg-yellow-500 text-white p-2 rounded-lg ml-2">Edit</button>
                )}
                <button onClick={() => handleDelete(category.id)} className="bg-red-500 text-white p-2 rounded-lg ml-2">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Categories;