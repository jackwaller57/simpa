import React from 'react';
import YesNoSelector from './YesNoSelector';

interface AltitudeCheckProps {
  passed10kFeet: boolean;
  onStatusChange: (passed: boolean) => void;
  disabled?: boolean;
}

const AltitudeCheck: React.FC<AltitudeCheckProps> = ({
  passed10kFeet,
  onStatusChange,
  disabled = false
}) => {
  return (
    <YesNoSelector
      prompt="Has aircraft passed 10,000 feet?"
      initialValue={passed10kFeet}
      onChange={(value) => onStatusChange(value === true)}
      disabled={disabled}
      required={true}
    />
  );
};

export default AltitudeCheck; 