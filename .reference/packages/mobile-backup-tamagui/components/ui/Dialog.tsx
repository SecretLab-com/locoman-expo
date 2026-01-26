import { styled, Dialog as TamaguiDialog, Adapt, Sheet, YStack, XStack, Text, GetProps } from 'tamagui';
import { X } from '@tamagui/lucide-icons';
import { Button } from './Button';

// Dialog Root
export const Dialog = TamaguiDialog;

// Dialog Trigger
export const DialogTrigger = TamaguiDialog.Trigger;

// Dialog Portal
export const DialogPortal = TamaguiDialog.Portal;

// Dialog Overlay
export const DialogOverlay = styled(TamaguiDialog.Overlay, {
  name: 'DialogOverlay',
  animation: 'fast',
  opacity: 0.5,
  backgroundColor: 'black',
  enterStyle: { opacity: 0 },
  exitStyle: { opacity: 0 },
});

// Dialog Content
export const DialogContent = styled(TamaguiDialog.Content, {
  name: 'DialogContent',
  backgroundColor: '$cardBackground',
  borderRadius: '$4',
  padding: '$5',
  maxWidth: 500,
  width: '90%',
  animation: 'fast',
  enterStyle: { opacity: 0, scale: 0.95, y: -10 },
  exitStyle: { opacity: 0, scale: 0.95, y: -10 },
  
  // Shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 20,
  elevation: 10,

  variants: {
    size: {
      sm: {
        maxWidth: 400,
        padding: '$4',
      },
      md: {
        maxWidth: 500,
        padding: '$5',
      },
      lg: {
        maxWidth: 700,
        padding: '$6',
      },
      full: {
        maxWidth: '95%',
        maxHeight: '90%',
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Dialog Header
export const DialogHeader = styled(YStack, {
  name: 'DialogHeader',
  gap: '$2',
  marginBottom: '$4',
});

// Dialog Title
export const DialogTitle = styled(TamaguiDialog.Title, {
  name: 'DialogTitle',
  fontSize: '$6',
  fontWeight: '600',
  color: '$color',
});

// Dialog Description
export const DialogDescription = styled(TamaguiDialog.Description, {
  name: 'DialogDescription',
  fontSize: '$3',
  color: '$mutedForeground',
});

// Dialog Footer
export const DialogFooter = styled(XStack, {
  name: 'DialogFooter',
  gap: '$3',
  justifyContent: 'flex-end',
  marginTop: '$4',
  paddingTop: '$4',
  borderTopWidth: 1,
  borderTopColor: '$borderColor',
});

// Dialog Close Button
export const DialogClose = TamaguiDialog.Close;

// Close icon button for top-right corner
export function DialogCloseButton() {
  return (
    <TamaguiDialog.Close asChild>
      <Button
        variant="ghost"
        size="icon"
        position="absolute"
        top="$3"
        right="$3"
        circular
      >
        <X size={20} />
      </Button>
    </TamaguiDialog.Close>
  );
}

// Responsive Dialog that becomes a Sheet on mobile
interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ResponsiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <Adapt when="sm" platform="touch">
        <Sheet
          animation="medium"
          zIndex={200000}
          modal
          dismissOnSnapToBottom
          snapPointsMode="fit"
        >
          <Sheet.Frame padding="$4" gap="$4">
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay
            animation="fast"
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
        </Sheet>
      </Adapt>

      <DialogPortal>
        <DialogOverlay key="overlay" />
        <DialogContent key="content" size={size}>
          <DialogCloseButton />
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export default Dialog;
