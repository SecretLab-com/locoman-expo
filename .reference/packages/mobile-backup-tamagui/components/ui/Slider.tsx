import React from 'react';
import { Slider as TamaguiSlider, SliderTrack, SliderTrackActive, SliderThumb, styled, GetProps } from 'tamagui';

const StyledSlider = styled(TamaguiSlider, {
  name: 'Slider',
  width: '100%',
});

const StyledTrack = styled(SliderTrack, {
  name: 'SliderTrack',
  height: 4,
  backgroundColor: '$gray6',
  borderRadius: '$10',
});

const StyledTrackActive = styled(SliderTrackActive, {
  name: 'SliderTrackActive',
  backgroundColor: '$blue10',
  borderRadius: '$10',
});

const StyledThumb = styled(SliderThumb, {
  name: 'SliderThumb',
  width: 20,
  height: 20,
  backgroundColor: '$blue10',
  borderRadius: '$10',
  borderWidth: 2,
  borderColor: '$background',
  
  hoverStyle: {
    scale: 1.1,
  },
  
  focusStyle: {
    scale: 1.1,
    outlineColor: '$blue10',
    outlineWidth: 2,
    outlineStyle: 'solid',
  },
});

export type SliderProps = GetProps<typeof TamaguiSlider> & {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

export function Slider({ 
  value = [0], 
  onValueChange, 
  min = 0, 
  max = 100, 
  step = 1,
  disabled,
  ...props 
}: SliderProps) {
  return (
    <StyledSlider
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
      {...props}
    >
      <StyledTrack>
        <StyledTrackActive />
      </StyledTrack>
      <StyledThumb index={0} circular />
    </StyledSlider>
  );
}

export default Slider;
