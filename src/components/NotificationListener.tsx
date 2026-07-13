import { useBusiness } from '../context/BusinessContext';
import { useCaseNotifications } from '../hooks/useCaseNotifications';

export default function NotificationListener() {
  const { business } = useBusiness();
  useCaseNotifications(business?.id || '');
  return null;
}