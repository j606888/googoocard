'use client';

import { CheckIcon } from "lucide-react";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    number: 1,
    title: 'Basic information',
  },
  {
    number: 2,
    title: 'Lesson periods',
  },
  {
    number: 3,
    title: 'Attend students',
  },
  {
    number: 4,
    title: 'Class card',
  },
  {
    number: 5,
    title: 'Review',
  },
]

const ProgressHeader = ({ currentStep }: { currentStep: number }) => {
  const leftPart: React.ReactNode[] = []
  const rightPart: React.ReactNode[] = []
  const widthPercentage = (currentStep / 5) * 100

  leftPart.push(<Link href={'/lessons'}><ArrowLeftIcon className="w-5 h-5 text-gray-600" /></Link>)

  STEPS.forEach((step) => {
    if (step.number < currentStep) {
      leftPart.push(<StepBall key={step.number} number={step.number} status="done" />)
    } else if (step.number === currentStep) {
      leftPart.push(<StepBall key={step.number} number={step.number} status="inProgress" title={step.title} />)
    } else {  
      rightPart.push(<StepBall key={step.number} number={step.number} status="pending" />)
    }
  })
  
  return (
    <div className="sticky top-0 w-full px-3 py-5 flex justify-between bg-white z-20">
      <div className='flex gap-3 items-center'>
        {leftPart}
      </div>
      <div className='flex gap-3'>
        {rightPart}
      </div>
      <div className="absolute bottom-0 left-0 right-0 w-full h-1 bg-gray-200"></div>
      <div className="absolute bottom-0 left-0 h-1 bg-primary-500" style={{ width: `${widthPercentage}%` }}></div>
    </div>
  );
};
// const ProgressHeader = ({ step }: { step: number }) => {
//   return (
//     <div className="sticky top-0 w-full px-3 py-5 flex justify-between bg-white">
//       <div className='flex gap-3'>
//         <StepBall number={1} title="Basic information" status="inProgress" />

//       </div>
//       <div className='flex gap-3'>
//         <StepBall number={2} status="pending" />
//         <StepBall number={3} status="pending" />
//         <StepBall number={4} status="pending" />
//         <StepBall number={5} status="pending" />
//       </div>
//       <div className="absolute bottom-0 left-0 right-0 w-full h-1 bg-gray-200"></div>
//       <div className="absolute bottom-0 left-0 w-1/5 h-1 bg-primary-500"></div>
//     </div>
//   );
// };


const StepBall = ({ number, title, status }: { number: number, title?: string, status: 'pending' | 'inProgress' | 'done' }) => {
  const active = ['inProgress', 'done'].includes(status);
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? 'bg-primary-500' : 'shadow-md bg-white'}`}>
        <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-500'}`}>
          {status === 'done' ? <CheckIcon className="w-4 h-4" /> : number}
        </span>
      </div>
      {title && <div className={`text-sm font-semibold`}>{title}</div>}
    </div>
  )
}

export default ProgressHeader;
