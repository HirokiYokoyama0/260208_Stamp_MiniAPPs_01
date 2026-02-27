'use client';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className="text-4xl transition-transform hover:scale-110 focus:outline-none"
          type="button"
        >
          {star <= value ? '⭐️' : '☆'}
        </button>
      ))}
    </div>
  );
}
