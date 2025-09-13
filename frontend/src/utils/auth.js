// Check if token is expired
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// Clear auth data and redirect to login
export const handleTokenExpiration = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('userID');
  sessionStorage.removeItem('hasVisitedLoading');
  window.location.href = '/login';
};

// Enhanced fetch with automatic token handling
export const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  if (!token || isTokenExpired(token)) {
    handleTokenExpiration();
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
      handleTokenExpiration();
      return;
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};