import colors from '../app/colors';

export default function PencilIcon({ size = 20, color = colors.gold }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M3 17.25V21h3.75l11.06-11.06a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0L3 17.25z"/>
      <path d="M14.06 7.02l2.92 2.92"/>
    </svg>
  );
} 