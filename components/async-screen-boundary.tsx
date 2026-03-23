import type { ReactNode } from 'react';

import { ScreenContainer } from '@/components/screen-container';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';

type AsyncScreenBoundaryProps = {
  isLoading?: boolean;
  isError?: boolean;
  loadingTitle?: string;
  loadingDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  children: ReactNode;
};

export function AsyncScreenBoundary({
  isLoading = false,
  isError = false,
  loadingTitle,
  loadingDescription,
  errorTitle,
  errorDescription,
  onRetry,
  children,
}: AsyncScreenBoundaryProps) {
  if (isLoading) {
    return (
      <ScreenContainer className='flex-1'>
        <LoadingState
          fullScreen
          title={loadingTitle}
          description={loadingDescription}
        />
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer className='flex-1'>
        <ErrorState
          fullScreen
          title={errorTitle}
          description={errorDescription}
          onRetry={onRetry}
        />
      </ScreenContainer>
    );
  }

  return <>{children}</>;
}
