export type TourPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  element: string;
  title: string;
  description: string;
  position: TourPosition;
}

export const tourSteps: TourStep[] = [
  {
    element: '#ai-tutor-btn',
    title: 'Your AI tutor',
    description: 'Ask questions and get clear, step-by-step explanations tailored to your learning profile.',
    position: 'right',
  },
  {
    element: '#study-library-nav',
    title: 'Your study library',
    description: 'Browse notes, past papers, and learning materials without leaving your dashboard.',
    position: 'right',
  },
  {
    element: '#study-progress-panel',
    title: 'Track your progress',
    description: 'Your saved plan tracks completed topics, daily study streaks, and progress over time.',
    position: 'top',
  },
  {
    element: '#study-plan-nav',
    title: 'Your personal study plan',
    description: 'Open your plan to see weekly topics, progress graphs, streaks, and resources chosen for your class and subjects.',
    position: 'right',
  },
  {
    element: '#user-profile',
    title: 'Your profile and settings',
    description: 'Update your learner details and preferences whenever your study needs change.',
    position: 'right',
  },
];
