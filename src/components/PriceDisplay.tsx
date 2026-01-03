import { useState, useEffect } from 'react';
import { type Price, convertToAud, formatPrice } from '@/lib/currency';

interface PriceDisplayProps {
  price: Price;
}

const PriceDisplay = ({ price }: PriceDisplayProps) => {
  const [displayPrice, setDisplayPrice] = useState<string>('...');

  useEffect(() => {
    const convertAndFormat = async () => {
      if (!price || price.amount <= 0) {
        setDisplayPrice('Price unknown!');
        return;
      }

      // If currency is already AUD, format immediately
      if (price.currency === 'AUD') {
        setDisplayPrice(formatPrice(price));
        return;
      }
      
      // If not AUD, show original price while converting
      setDisplayPrice(formatPrice(price) + '...');

      try {
        const audPrice = await convertToAud(price);
        setDisplayPrice(formatPrice(audPrice));
      } catch (error) {
        console.error('Price conversion failed:', error);
        // Fallback to showing the original price if conversion fails
        setDisplayPrice(formatPrice(price));
      }
    };

    convertAndFormat();
  }, [price]); // Re-run effect if the price object changes

  return (
     <p className="text-blue-400 font-semibold text-md sm:text-lg mt-1 sm:mt-2 text-shadow-sm">
      {displayPrice}
    </p>
  );
};

export default PriceDisplay;