import type { ViewProps } from 'react-native';

import { SurfaceCard } from './surface-card';

type CardProps = ViewProps & {
  className?: string;
};

export function Card(props: CardProps) {
  return <SurfaceCard tone='default' elevated {...props} />;
}

export function InsetCard(props: CardProps) {
  return <SurfaceCard tone='alt' border='subtle' {...props} />;
}
