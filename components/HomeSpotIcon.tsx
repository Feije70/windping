// Huis met vlag — homespot icoon voor WindPing
// Warm, herkenbaar op klein formaat, past bij het maritieme/outdoor gevoel

interface HomeSpotIconProps {
  size?: number;
  color?: string;
  flagColor?: string;
}

export default function HomeSpotIcon({
  size = 20,
  color = "#E8A83E",
  flagColor = "white",
}: HomeSpotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Huis body — gevuld */}
      <path
        d="M14 6L3 14V26H11V19H17V26H25V14L14 6Z"
        fill={color}
        opacity="0.9"
      />
      {/* Deur */}
      <rect x="11.5" y="19" width="5" height="7" rx="1" fill={flagColor} opacity="0.5" />
      {/* Vlagmast — loopt door boven het dak */}
      <line x1="14" y1="6" x2="14" y2="1.5" stroke={flagColor} strokeWidth="1.8" strokeLinecap="round" />
      {/* Vlag — driehoek rechtsboven de mast */}
      <path d="M14 1.5 L21 4 L14 6.5Z" fill={flagColor} opacity="0.95" />
    </svg>
  );
}
