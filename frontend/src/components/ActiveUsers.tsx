import { useState } from 'react';

interface User {
  id: string;
  name: string;
  color: string;
  emoji: string;
  joined_at: string;
}

interface ActiveUsersProps {
  users: User[];
  currentUserName: string;
}

export function ActiveUsers({ users, currentUserName }: ActiveUsersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  if (users.length === 0) {
    return null;
  }

  // Get initials from name (e.g., "Anonymous Panda" -> "AP")
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayUsers = users.slice(0, 5);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsDropdownOpen(true)}
      onMouseLeave={() => setIsDropdownOpen(false)}
    >
      {/* Overlapping Avatars */}
      <div className="flex -space-x-2 cursor-pointer">
        {displayUsers.map((user, index) => {
          const isCurrentUser = user.name === currentUserName;
          return (
            <div
              key={user.id}
              className="relative transition-all duration-300 ease-out hover:scale-110 hover:z-10"
              style={{
                transitionDelay: `${index * 20}ms`
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 shadow-sm transition-all duration-300 ease-out hover:shadow-lg"
                style={{
                  backgroundColor: user.color,
                  borderColor: `rgb(var(--bg-primary))`,
                }}
              >
                {getInitials(user.name)}
              </div>
              {isCurrentUser && (
                <div 
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 animate-pulse"
                  style={{ borderColor: `rgb(var(--bg-primary))` }}
                />
              )}
            </div>
          );
        })}
        {users.length > 5 && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 shadow-sm transition-all duration-300 ease-out hover:scale-110 hover:shadow-lg"
            style={{
              backgroundColor: `rgb(var(--bg-tertiary))`,
              color: `rgb(var(--text-secondary))`,
              borderColor: `rgb(var(--bg-primary))`,
            }}
          >
            +{users.length - 5}
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      <div 
        className="absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto transition-all duration-300 ease-out origin-top"
        style={{
          backgroundColor: `rgb(var(--bg-secondary))`,
          border: `1px solid rgb(var(--border-color))`,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          opacity: isDropdownOpen ? 1 : 0,
          transform: isDropdownOpen ? 'scaleY(1) translateY(0)' : 'scaleY(0.95) translateY(-10px)',
          pointerEvents: isDropdownOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: `rgb(var(--border-color))` }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold" style={{ color: `rgb(var(--text-primary))` }}>
              {users.length} user{users.length !== 1 ? 's' : ''} online
            </span>
          </div>
        </div>

        {/* User List */}
        <div className="py-2">
          {users.map((user, index) => {
            const isCurrentUser = user.name === currentUserName;
            return (
              <div
                key={user.id}
                className="px-4 py-2 flex items-center gap-3 transition-all duration-200 ease-out hover:bg-opacity-50"
                style={{
                  backgroundColor: isCurrentUser ? `rgba(var(--border-color), 0.3)` : 'transparent',
                  opacity: isDropdownOpen ? 1 : 0,
                  transform: isDropdownOpen ? 'translateX(0)' : 'translateX(-10px)',
                  transitionDelay: isDropdownOpen ? `${index * 30}ms` : '0ms',
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 transition-transform duration-200 hover:scale-110"
                  style={{ backgroundColor: user.color }}
                >
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: `rgb(var(--text-primary))` }}>
                    {user.name}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs font-normal" style={{ color: `rgb(var(--text-tertiary))` }}>
                        (You)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
