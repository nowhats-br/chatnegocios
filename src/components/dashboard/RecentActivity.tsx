import React, { useState, useEffect } from 'react';
import { faker } from '@faker-js/faker';

interface Activity {
  id: string;
  avatar: string;
  name: string;
  action: string;
  time: string;
}

const generateMockActivity = (): Activity[] => {
  return Array.from({ length: 5 }, () => ({
    id: faker.string.uuid(),
    avatar: faker.image.avatar(),
    name: faker.person.fullName(),
    action: 'iniciou uma nova conversa.',
    time: faker.date.recent({ days: 1 }).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }));
};

const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    setActivities(generateMockActivity());
  }, []);

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {activities.map((activity, activityIdx) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {activityIdx !== activities.length - 1 ? (
                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center ring-8 ring-card">
                    <img className="h-full w-full rounded-full object-cover" src={activity.avatar} alt="" />
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="typography-body-sm text-foreground">
                      <span className="font-semibold">{activity.name}</span> {activity.action}
                    </p>
                  </div>
                  <div className="whitespace-nowrap text-right typography-body-sm typography-muted">
                    <time>{activity.time}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivity;
