import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';

// Storage abstraction for cross-platform support
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    // For native, we'll use a simple in-memory fallback for now
    // In production, use expo-secure-store or async-storage
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    }
  },
};
import { useToast } from '@/components/ui/Toast';

interface CartItem {
  id: number;
  bundleId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  trainerId?: number;
  trainerName?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (bundleId: number) => void;
  updateQuantity: (bundleId: number, quantity: number) => void;
  clearCart: () => void;
  isInCart: (bundleId: number) => boolean;
  getItemQuantity: (bundleId: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = '@locomotivate_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();
  
  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);
  
  // Save cart to storage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveCart();
    }
  }, [items, isLoaded]);
  
  const loadCart = async () => {
    try {
      const stored = await storage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setIsLoaded(true);
    }
  };
  
  const saveCart = async () => {
    try {
      await storage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  };
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const addItem = (newItem: Omit<CartItem, 'id'>) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(item => item.bundleId === newItem.bundleId);
      
      if (existingIndex >= 0) {
        // Update quantity of existing item
        const updated = [...currentItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + (newItem.quantity || 1),
        };
        toast({ title: 'Cart Updated', description: `${newItem.name} quantity updated` });
        return updated;
      } else {
        // Add new item
        const item: CartItem = {
          ...newItem,
          id: Date.now(),
          quantity: newItem.quantity || 1,
        };
        toast({ title: 'Added to Cart', description: `${newItem.name} added to cart` });
        return [...currentItems, item];
      }
    });
  };
  
  const removeItem = (bundleId: number) => {
    setItems(currentItems => {
      const item = currentItems.find(i => i.bundleId === bundleId);
      if (item) {
        toast({ title: 'Removed from Cart', description: `${item.name} removed` });
      }
      return currentItems.filter(item => item.bundleId !== bundleId);
    });
  };
  
  const updateQuantity = (bundleId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(bundleId);
      return;
    }
    
    setItems(currentItems => 
      currentItems.map(item => 
        item.bundleId === bundleId 
          ? { ...item, quantity } 
          : item
      )
    );
  };
  
  const clearCart = () => {
    setItems([]);
    toast({ title: 'Cart Cleared', description: 'All items removed from cart' });
  };
  
  const isInCart = (bundleId: number) => {
    return items.some(item => item.bundleId === bundleId);
  };
  
  const getItemQuantity = (bundleId: number) => {
    const item = items.find(i => i.bundleId === bundleId);
    return item?.quantity || 0;
  };
  
  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalAmount,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isInCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
