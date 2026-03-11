import type { ViewProps } from 'react-native';

import { SurfaceCard } from './surface-card';

type ModalSurfaceProps = ViewProps & {
  className?: string;
};

export function ModalSurface(props: ModalSurfaceProps) {
  return <SurfaceCard tone='elevated' elevated border='strong' {...props} />;
}
