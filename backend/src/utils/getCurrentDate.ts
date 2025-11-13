import dayjs from 'dayjs';

export const getCurrentDate = () => {
    return dayjs().format('YYYY-MM-DD HH:mm:ss');
};