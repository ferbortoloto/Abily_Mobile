import React, { createContext, useContext, useRef, useState } from 'react';

const AvailabilityGuardContext = createContext(null);

export function AvailabilityGuardProvider({ children }) {
  const [isDirty, setIsDirty] = useState(false);
  // saveRef always points to the latest save function from AvailabilityManager
  const saveRef = useRef(null);

  return (
    <AvailabilityGuardContext.Provider value={{ isDirty, setIsDirty, saveRef }}>
      {children}
    </AvailabilityGuardContext.Provider>
  );
}

export const useAvailabilityGuard = () => useContext(AvailabilityGuardContext);
