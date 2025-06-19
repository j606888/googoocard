type Status = 'pending' | 'inProgress' | 'done';

interface BallProps {
  children?: React.ReactNode;
  status: Status;
}
const ProgressBall = ({ currentStep = 1 }: { currentStep?: 1 | 2 | 3 | 4 | 5 }) => {
  const steps = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center justify-center gap-9">
      {steps.map((step) => {
        const ballStatus: Status =
          currentStep > step ? 'done' : currentStep === step ? 'inProgress' : 'pending';
        const lineStatus: Status =
          currentStep >= step + 1 ? 'done' : 'pending';

        return (
          <div key={step} className="relative flex items-center">
            <Ball status={ballStatus} />
            {step < 5 && <Line status={lineStatus} />}
          </div>
        );
      })}
    </div>
  );
};

const Ball = ({ status }: BallProps) => {
  const bgColor = {
    pending: 'bg-gray-300',
    inProgress: 'bg-primary-500',
    done: 'bg-primary-300',
  }[status];

  return <div className={`relative z-10 w-5 h-5 rounded-full ${bgColor}`} />;
};

const Line = ({ status }: { status: Status }) => {
  const bgColor = {
    pending: 'bg-gray-300',
    inProgress: 'bg-primary-500',
    done: 'bg-primary-300',
  }[status];

  return (
    <div className={`absolute left-1/2 translate-x-2.5 w-[55px] h-[2px] z-0 ${bgColor}`} />
  );
};

export default ProgressBall;