import React, { useState } from 'react';
import { HiOutlineShare } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { IPad } from '../../services/pads';
import DistributeModal from './DistributeModal';
import { isWorksheetContent } from '../../utils/WorksheetParser';

interface PadDistributeProps {
  data: IPad;
}

export function PadDistribute({ data }: PadDistributeProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'teacher' && user?.role !== 'admin') return null;
  if (data.padType !== 'worksheet' && !isWorksheetContent(data.content ?? '')) return null;

  return (
    <>
      <button
        className="dropdown-item flex items-center gap-2 w-full"
        onClick={() => setOpen(true)}
      >
        <HiOutlineShare size={16} />
        <span>Distribute to Classroom</span>
      </button>
      {open && <DistributeModal pad={data} onClose={() => setOpen(false)} />}
    </>
  );
}
