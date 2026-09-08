import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

export type AppIconName =
  | 'swipe'
  | 'explore'
  | 'heart'
  | 'bell'
  | 'history'
  | 'profile'
  | 'filter'
  | 'plus'
  | 'close'
  | 'location'
  | 'arrow';

interface Props {
  name: AppIconName;
  size?: number;
  color?: string;
  filled?: boolean;
}

const AppIcon = ({name, size = 22, color = '#FFF', filled = false}: Props) => {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'heart' && (
        <Path
          {...common}
          fill={filled ? color : 'none'}
          d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z"
        />
      )}
      {name === 'profile' && (
        <>
          <Circle {...common} cx="12" cy="7" r="4" />
          <Path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0Z" />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path
            {...common}
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
          />
          <Path {...common} d="M10 21h4" />
        </>
      )}
      {name === 'history' && (
        <>
          <Circle {...common} cx="12" cy="12" r="8.5" />
          <Path {...common} d="M12 7.5V12l3 2" />
          <Path {...common} d="M7 4.8 4.5 5.5 5.2 8" />
        </>
      )}
      {name === 'explore' && (
        <>
          <Circle {...common} cx="12" cy="12" r="9" />
          <Path {...common} d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
        </>
      )}
      {name === 'swipe' && (
        <>
          <Path {...common} d="M4 7h16M7 4 4 7l3 3M20 17H4m13-3 3 3-3 3" />
          <Path {...common} d="M9 12h6" />
        </>
      )}
      {name === 'filter' && (
        <>
          <Path {...common} d="M4 6h16M4 12h16M4 18h16" />
          <Circle cx="9" cy="6" r="2" fill={color} />
          <Circle cx="15" cy="12" r="2" fill={color} />
          <Circle cx="8" cy="18" r="2" fill={color} />
        </>
      )}
      {name === 'plus' && <Path {...common} d="M12 4v16M4 12h16" />}
      {name === 'close' && <Path {...common} d="m5 5 14 14M19 5 5 19" />}
      {name === 'location' && (
        <>
          <Path
            {...common}
            d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
          />
          <Circle {...common} cx="12" cy="10" r="2.5" />
        </>
      )}
      {name === 'arrow' && <Path {...common} d="m9 18 6-6-6-6" />}
    </Svg>
  );
};

export default AppIcon;
