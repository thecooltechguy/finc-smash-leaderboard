"use client";

import { Player } from "@/lib/supabase";
import { ArrowUpDown, List, Swords, Trophy, Users } from "lucide-react";
import React, { memo, useEffect, useState } from "react";

// Extended player interface for frontend with real stats
interface ExtendedPlayer extends Player {
  matches: number;
  main_character?: string;
  total_wins?: number;
  total_losses?: number;
  total_kos?: number;
  total_falls?: number;
  total_sds?: number;
}

// Match participant interface
interface MatchParticipant {
  id: number;
  player: number;
  player_name: string;
  player_display_name: string | null;
  smash_character: string;
  is_cpu: boolean;
  total_kos: number;
  total_falls: number;
  total_sds: number;
  has_won: boolean;
}

// Match interface
interface Match {
  id: number;
  created_at: string;
  participants: MatchParticipant[];
}

type Tier = "S" | "A" | "B" | "C" | "D" | "E";

// Memoized component for refresh status to prevent unnecessary rerendersO
const RefreshStatus = memo(
  ({
    refreshing,
    countdown,
    lastUpdated,
    centered = false,
  }: {
    refreshing: boolean;
    countdown: number;
    lastUpdated: Date | null;
    centered?: boolean;
  }) => {
    if (!lastUpdated) return null;

    return (
      <p
        className={`text-sm text-gray-200 mt-1 flex items-center ${
          centered ? "justify-center" : ""
        }`}
      >
        {refreshing ? (
          <>
            <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full mr-2"></div>
            Refreshing...
          </>
        ) : (
          <>
            {/* <span>Last updated: {lastUpdated.toLocaleTimeString()}</span> */}
            {/* <span className="mx-2 text-gray-400">•</span> */}
            <span className="mr-2 text-green-300">●</span>
            <span>Refreshing in {countdown}s</span>
          </>
        )}
      </p>
    );
  }
);

RefreshStatus.displayName = "RefreshStatus";

export default function SmashTournamentELO() {
  // State management
  const [players, setPlayers] = useState<ExtendedPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<
    "tiers" | "rankings" | "matches" | "players"
  >("rankings");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);

  // Function to handle player click and scroll
  const handlePlayerClick = (playerId: number) => {
    setActiveTab("players");
    // Use setTimeout to ensure the tab switch happens before scrolling
    setTimeout(() => {
      const element = document.getElementById(`player-${playerId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  // Load Google Font
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Calculate percentile-based tier thresholds
  const calculateTierThresholds = (sortedPlayers: ExtendedPlayer[]) => {
    if (sortedPlayers.length === 0) {
      return { S: 2000, A: 1800, B: 1600, C: 1400, D: 1200 };
    }

    const totalPlayers = sortedPlayers.length;

    // Define what percentage of players should be in each tier
    const tierPercentages = {
      S: 0.15, // Top 15% of players
      A: 0.3, // Next 15% (top 30% total)
      B: 0.5, // Next 20% (top 50% total)
      C: 0.75, // Next 25% (top 75% total)
      D: 0.9, // Next 15% (top 90% total)
      // E: remaining 10%
    };

    const getPlayerAtPercentile = (percentile: number) => {
      const index = Math.min(
        sortedPlayers.length - 1,
        Math.floor(percentile * totalPlayers)
      );
      return sortedPlayers[index];
    };

    return {
      S: sortedPlayers[0]?.elo || 2000, // Top player's ELO
      A: getPlayerAtPercentile(tierPercentages.S)?.elo || 1800,
      B: getPlayerAtPercentile(tierPercentages.A)?.elo || 1600,
      C: getPlayerAtPercentile(tierPercentages.B)?.elo || 1400,
      D: getPlayerAtPercentile(tierPercentages.C)?.elo || 1200,
    };
  };

  // Fetch players from database
  useEffect(() => {
    fetchPlayers();
    fetchMatches();

    // Set up automatic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchPlayers(true); // Pass true to indicate this is a background refresh
      fetchMatches();
      setCountdown(30); // Reset countdown after refresh
    }, 30000);

    // Set up countdown timer every second
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30; // Reset to 30 when it reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup intervals on component unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const fetchPlayers = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/players");
      if (!response.ok) {
        throw new Error("Failed to fetch players");
      }
      const data: Array<{
        id: number;
        name: string;
        display_name: string | null;
        elo: number;
        created_at: string;
        main_character?: string;
        total_wins?: number;
        total_losses?: number;
      }> = await response.json();

      // Process players with real stats from database
      const playersWithMatches = data.map((player) => ({
        ...player,
        matches: (player.total_wins || 0) + (player.total_losses || 0),
      }));

      setPlayers(playersWithMatches);
      setLastUpdated(new Date());

      // Check for hash after players are loaded
      const hash = window.location.hash;
      if (hash.startsWith('#player-')) {
        const playerId = parseInt(hash.replace('#player-', ''));
        setActiveTab("players");
        setTimeout(() => {
          const element = document.getElementById(`player-${playerId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error fetching players:", err);
      setError("Failed to load players. Please try again later.");
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await fetch("/api/matches");
      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }
      const data: Match[] = await response.json();
      setMatches(data);
    } catch (err) {
      console.error("Error fetching matches:", err);
      // Don't set error state for matches as it's secondary to players
    }
  };

  // Determine tier based on ELO using percentile-based thresholds
  const getTier = (
    elo: number,
    tierThresholds: ReturnType<typeof calculateTierThresholds>
  ): Tier => {
    if (elo >= tierThresholds.S) return "S";
    if (elo >= tierThresholds.A) return "A";
    if (elo >= tierThresholds.B) return "B";
    if (elo >= tierThresholds.C) return "C";
    if (elo >= tierThresholds.D) return "D";
    return "E";
  };

  // Sort players by ELO
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

  // Calculate dynamic tier thresholds
  const tierThresholds = calculateTierThresholds(sortedPlayers);

  // Get player initials from name or display_name
  const getInitials = (player: ExtendedPlayer): string => {
    const nameToUse = player.display_name || player.name;
    return nameToUse
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
  };

  // Get profile picture for player based on name
  const getProfilePicture = (player: ExtendedPlayer): string | null => {
    const nameToUse = (player.display_name || player.name).toLowerCase();

    // Map player names to their image files
    if (nameToUse.includes("nish")) return "/images/anish.png";
    if (nameToUse.includes("habeas") || nameToUse.includes("haseab"))
      return "/images/habeas.png";
    if (nameToUse.includes("subby")) return "/images/subby.png";
    if (nameToUse.includes("pat")) return "/images/pat.png";
    if (nameToUse.includes("will")) return "/images/will.png";
    if (nameToUse.includes("ryy")) return "/images/ryy.png";
    if (nameToUse.includes("jmoon")) return "/images/jmoon.png";
    if (nameToUse.includes("keneru")) return "/images/keneru.png";

    return null;
  };

  // Get tier badge color
  const getTierBadgeColor = (tier: Tier): string => {
    switch (tier) {
      case "S":
        return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black";
      case "A":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white";
      case "B":
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white";
      case "C":
        return "bg-gradient-to-r from-green-500 to-green-600 text-white";
      case "D":
        return "bg-gradient-to-r from-purple-500 to-purple-600 text-white";
      case "E":
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white";
      default:
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white";
    }
  };

  // Group players by tier for tier list
  const tierList: Record<Tier, ExtendedPlayer[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
  };

  sortedPlayers.forEach((player) => {
    const tier = getTier(player.elo, tierThresholds);
    tierList[tier].push(player);
  });

  return (
    <div
      className="flex flex-col items-center p-6 md:p-0 min-h-screen bg-black text-white antialiased"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.4) 0%, rgba(0, 0, 0, 0.8) 100%)",
        backgroundAttachment: "fixed",
        fontFamily: "'Roboto Mono', monospace",
      }}
    >
      {/* Smash-style header */}
      <header className="max-w-5xl w-full bg-gradient-to-r from-red-600 to-red-700 border-b-4 border-yellow-500 shadow-lg relative overflow-hidden rounded-3xl md:mt-4">
        {/* Glare effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

        <div className="py-6 flex justify-center items-center relative z-10">
          <div className="flex items-center space-x-8">
            {/* Founders Inc Logo */}
            <img
              src="/images/founders-icon.png"
              alt="Founders Inc Logo"
              className="hidden md:block h-12 w-auto object-contain"
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
              }}
            />

            <h1
              className="hidden md:block text-5xl font-bold tracking-wide uppercase text-white"
              style={{
                textShadow:
                  "0 0 15px rgba(255, 255, 255, 0.6), 3px 3px 6px rgba(0, 0, 0, 0.8)",
                letterSpacing: "0.15em",
              }}
            >
              ×
            </h1>

            {/* Smash Bros Logo */}
            <img
              src="/images/smash-logo.png"
              alt="Super Smash Bros Logo"
              className="h-16 w-auto object-contain"
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
              }}
            />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 shadow-md sticky top-0 z-50 mt-6 rounded-xl mx-4">
        <div className="">
          <ul className="flex rounded-xl overflow-hidden">
            {[
              { id: "rankings", icon: <Trophy size={20} />, label: "Rankings" },
              { id: "tiers", icon: <List size={20} />, label: "Tier List" },
              { id: "matches", icon: <Swords size={20} />, label: "Matches" },
              { id: "players", icon: <Users size={20} />, label: "Players" },
            ].map((tab, index) => (
              <li key={tab.id} className="">
                <button
                  onClick={() =>
                    setActiveTab(
                      tab.id as "tiers" | "rankings" | "matches" | "players"
                    )
                  }
                  className={`w-full px-2 py-3 md:px-4 md:py-5 flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-3 transition-all duration-200 relative overflow-hidden text-sm md:text-xl font-semibold ${
                    activeTab === tab.id
                      ? "bg-gradient-to-b from-red-600 to-red-700 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                  style={{
                    boxShadow:
                      activeTab === tab.id
                        ? "inset 0 -3px 0 rgba(255, 215, 0, 0.7)"
                        : "none",
                    borderRadius:
                      index === 0
                        ? "0.75rem 0 0 0.75rem"
                        : index === 3
                        ? "0 0.75rem 0.75rem 0"
                        : "0",
                  }}
                >
                  {/* Glare effect for active tab */}
                  {activeTab === tab.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>
                  )}

                  <span className="relative z-10">
                    <span className="block md:hidden">
                      {React.cloneElement(tab.icon, { size: 16 })}
                    </span>
                    <span className="hidden md:block">{tab.icon}</span>
                  </span>
                  <span className="relative z-10 text-xs md:text-xl">
                    {tab.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl w-full py-3">
        {error && (
          <div className="bg-gradient-to-r from-red-600 to-red-700 border border-red-800 text-white px-4 py-3 rounded-xl mb-6 flex justify-between items-center shadow-lg">
            <span className="text-lg">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-white hover:text-gray-200 rounded-full h-6 w-6 flex items-center justify-center bg-red-800"
            >
              &times;
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div
              className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500"
              style={{
                boxShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
              }}
            ></div>
          </div>
        ) : (
          <>
            {/* Rankings Tab */}
            {activeTab === "rankings" && (
              <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-lg relative">
                {/* Loading overlay when refreshing */}
                {refreshing && (
                  <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                      <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                      <span className="text-white font-medium">
                        Updating rankings...
                      </span>
                    </div>
                  </div>
                )}

                <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                  {/* Glare effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                  <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <Trophy
                        className="mr-3 text-yellow-500"
                        size={24}
                        style={{
                          filter: "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                        }}
                      />
                      <div>
                        <h2
                          className="text-2xl font-bold text-white"
                          style={{
                            textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                          }}
                        >
                          Leaderboard
                        </h2>
                      </div>
                    </div>
                    <RefreshStatus
                      refreshing={refreshing}
                      countdown={countdown}
                      lastUpdated={lastUpdated}
                      centered={false}
                    />
                  </div>
                </div>

                {sortedPlayers.length === 0 ? (
                  <div className="text-gray-400 text-center py-16 px-6">
                    <p className="text-2xl font-bold">
                      No fighters have entered the arena yet!
                    </p>
                    <p className="mt-2 text-lg">
                      Add some fighters to begin the tournament
                    </p>
                  </div>
                ) : (
                  <div
                    className={`p-6 transition-opacity duration-300 ${
                      refreshing ? "opacity-75" : "opacity-100"
                    }`}
                  >
                    <div className="overflow-hidden rounded-xl">
                      <table className="w-full divide-y divide-gray-800">
                        <thead>
                          <tr className="bg-gradient-to-r from-gray-800 to-gray-700">
                            <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tl-xl w-24">
                              Rank
                            </th>
                            <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider">
                              Player
                            </th>
                            {/* <th className="px-4 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider w-32">
                              Main
                            </th> */}
                            <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider w-32">
                              <div className="flex items-center">
                                <span>ELO</span>
                                <ArrowUpDown
                                  size={12}
                                  className="ml-1 md:ml-2 text-gray-500 md:w-5 md:h-5"
                                />
                              </div>
                            </th>
                            <th className="px-2 py-3 md:px-6 md:py-6 text-left text-xs md:text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tr-xl w-24">
                              Tier
                            </th>
                            {/* <th className="px-4 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider rounded-tr-xl w-32">
                              Record
                            </th> */}
                          </tr>
                        </thead>
                        <tbody className="bg-gray-900 divide-y divide-gray-800">
                          {sortedPlayers.map((player, index) => {
                            const isLast = index === sortedPlayers.length - 1;
                            return (
                              <tr
                                key={player.id}
                                className="hover:bg-gray-800 transition-colors duration-150"
                              >
                                <td
                                  className={`px-2 py-3 md:px-6 md:py-8 whitespace-nowrap ${
                                    isLast ? "rounded-bl-xl" : ""
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <span className="text-sm md:text-3xl font-bold text-white">
                                      #{index + 1}
                                    </span>
                                    {index === 0 && (
                                      <Trophy
                                        size={14}
                                        className="ml-1 md:ml-3 md:w-6 md:h-6 text-yellow-500"
                                        style={{
                                          filter:
                                            "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                                        }}
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-3 md:px-6 md:py-8 whitespace-nowrap text-sm md:text-2xl font-bold text-white">
                                  <div 
                                    className="flex items-center space-x-2 md:space-x-4 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => handlePlayerClick(player.id)}
                                  >
                                    {getProfilePicture(player) ? (
                                      <img
                                        src={getProfilePicture(player)!}
                                        alt={player.display_name || player.name}
                                        className="h-8 w-8 md:h-14 md:w-14 rounded-full object-cover border-2 border-gray-600"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 md:h-14 md:w-14 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                                        <span className="text-xs md:text-lg font-bold text-gray-300">
                                          {getInitials(player)}
                                        </span>
                                      </div>
                                    )}
                                    <span>
                                      {player.display_name || player.name}
                                    </span>
                                  </div>
                                </td>
                                {/* <td className="px-4 py-5 whitespace-nowrap text-sm text-gray-400">
                                  {player.main_character ? (
                                    <span className="bg-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                                      {player.main_character}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 italic text-sm">
                                      No matches
                                    </span>
                                  )}
                                </td> */}
                                <td className="px-2 py-3 md:px-6 md:py-8 whitespace-nowrap">
                                  <span
                                    className="text-sm md:text-2xl font-bold text-yellow-500 bg-gray-800 px-2 py-1 md:px-4 md:py-2 rounded-full"
                                    style={{
                                      textShadow:
                                        "0 0 10px rgba(255, 215, 0, 0.6)",
                                    }}
                                  >
                                    {player.elo}
                                  </span>
                                </td>
                                <td
                                  className={`px-2 py-3 md:px-6 md:py-8 whitespace-nowrap ${
                                    isLast ? "rounded-br-xl" : ""
                                  }`}
                                >
                                  <span
                                    className={`px-2 py-1 md:px-4 md:py-2 inline-flex text-xs md:text-lg font-bold rounded-full ${getTierBadgeColor(
                                      getTier(player.elo, tierThresholds)
                                    )} shadow-lg`}
                                  >
                                    {getTier(player.elo, tierThresholds)}
                                  </span>
                                </td>
                                {/* <td
                                  className={`px-4 py-5 whitespace-nowrap ${
                                    isLast ? "rounded-br-xl" : ""
                                  }`}
                                >
                                  <span className="bg-gray-800 px-3 py-1 rounded-full inline-flex items-center text-sm font-medium">
                                    <span className="text-green-400 font-bold">
                                      {player.total_wins || 0}W
                                    </span>
                                    <span className="mx-1 text-gray-500">
                                      -
                                    </span>
                                    <span className="text-red-400 font-bold">
                                      {player.total_losses || 0}L
                                    </span>
                                  </span>
                                </td> */}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Character Selection Grid (Tier List) */}
            {activeTab === "tiers" && (
              <div>
                {sortedPlayers.length === 0 ? (
                  <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                    <p className="text-2xl font-bold">
                      No fighters have entered the arena yet!
                    </p>
                    <p className="mt-2 text-lg">
                      Add some fighters to begin the tournament
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                    {/* Loading overlay when refreshing */}
                    {refreshing && (
                      <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                        <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                          <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                          <span className="text-white font-medium">
                            Updating tier list...
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center relative overflow-hidden rounded-t-2xl">
                      {/* Glare effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                      <div className="text-center relative z-10">
                        <h2
                          className="text-2xl font-bold text-white uppercase tracking-wider"
                          style={{
                            textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                          }}
                        >
                          Official Tier List
                        </h2>
                        <RefreshStatus
                          refreshing={refreshing}
                          countdown={countdown}
                          lastUpdated={lastUpdated}
                          centered={true}
                        />
                      </div>
                    </div>

                    <div
                      className={`p-6 transition-opacity duration-300 ${
                        refreshing ? "opacity-75" : "opacity-100"
                      }`}
                    >
                      {/* Tier List Table */}
                      <div className="space-y-1">
                        {(["S", "A", "B", "C", "D", "E"] as Tier[]).map(
                          (tierName) => {
                            const tierPlayers = tierList[tierName];

                            return (
                              <div
                                key={tierName}
                                className="flex bg-gray-800 rounded-lg border border-gray-700 relative"
                              >
                                {/* Tier Label */}
                                <div
                                  className={`${getTierBadgeColor(
                                    tierName
                                  )} w-20 flex items-center justify-center py-4`}
                                >
                                  <span
                                    className="text-3xl font-bold text-white"
                                    style={{
                                      textShadow:
                                        "2px 2px 4px rgba(0, 0, 0, 0.8)",
                                    }}
                                  >
                                    {tierName}
                                  </span>
                                </div>

                                {/* Players in Tier */}
                                <div className="flex-1 p-4 relative">
                                  {tierPlayers.length === 0 ? (
                                    <div className="flex items-center justify-center h-16 text-gray-500 italic">
                                      No players in this tier
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-4">
                                      {tierPlayers.map((player) => (
                                        <div
                                          key={player.id}
                                          className="relative group cursor-pointer"
                                          title={`${
                                            player.display_name || player.name
                                          } - ELO: ${player.elo}`}
                                          onClick={() => handlePlayerClick(player.id)}
                                        >
                                          <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-600 group-hover:border-yellow-400 transition-all duration-200 bg-gray-700">
                                            {getProfilePicture(player) ? (
                                              <img
                                                src={getProfilePicture(player)!}
                                                alt={
                                                  player.display_name ||
                                                  player.name
                                                }
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-700">
                                                <span
                                                  className="text-lg font-bold text-white"
                                                  style={{
                                                    textShadow:
                                                      "1px 1px 2px rgba(0, 0, 0, 0.8)",
                                                  }}
                                                >
                                                  {getInitials(player)}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Player name and ELO tooltip on hover */}
                                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black bg-opacity-95 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999] shadow-xl border border-gray-600">
                                            <div className="font-semibold">
                                              {player.display_name ||
                                                player.name}
                                            </div>
                                            <div className="text-yellow-400 font-bold">
                                              ELO: {player.elo}
                                            </div>
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Matches Tab */}
            {activeTab === "matches" && (
              <div>
                {matches.length === 0 ? (
                  <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                    <p className="text-2xl font-bold">
                      No battles have been fought yet!
                    </p>
                    <p className="mt-2 text-lg">
                      Start playing some matches to see the battle history
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                    {/* Loading overlay when refreshing */}
                    {refreshing && (
                      <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                        <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                          <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                          <span className="text-white font-medium">
                            Updating match history...
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                      {/* Glare effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                      <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                        <div className="flex items-center space-x-2">
                          <Swords
                            className="mr-3 text-yellow-500"
                            size={24}
                            style={{
                              filter:
                                "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                            }}
                          />
                          <div>
                            <h2
                              className="text-2xl font-bold text-white"
                              style={{
                                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                              }}
                            >
                              Match History
                            </h2>
                          </div>
                        </div>
                        <RefreshStatus
                          refreshing={refreshing}
                          countdown={countdown}
                          lastUpdated={lastUpdated}
                          centered={false}
                        />
                      </div>
                    </div>

                    <div
                      className={`p-6 transition-opacity duration-300 ${
                        refreshing ? "opacity-75" : "opacity-100"
                      }`}
                    >
                      <div className="space-y-4">
                        {matches.slice(0, 20).map((match) => {
                          const participants = match.participants.sort(
                            (a, b) => {
                              if (a.has_won && !b.has_won) return -1;
                              if (!a.has_won && b.has_won) return 1;
                              return 0;
                            }
                          );

                          return (
                            <div
                              key={match.id}
                              className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                            >
                              <div className="flex flex-col space-y-4">
                                {/* Match Header */}
                                <div className="flex justify-between items-center">
                                  <div className="text-gray-400 text-sm">
                                    {new Date(
                                      match.created_at
                                    ).toLocaleDateString()}{" "}
                                    •{" "}
                                    {new Date(
                                      match.created_at
                                    ).toLocaleTimeString()}
                                  </div>
                                  <div className="text-gray-500 font-medium">
                                    {participants.length} Player
                                    {participants.length > 1 ? "s" : ""}
                                  </div>
                                </div>

                                {/* All Participants */}
                                <div className="flex flex-wrap gap-4 justify-between">
                                  {participants.map((participant) => (
                                    <div
                                      key={participant.id}
                                      className={`flex flex-col space-y-3 px-4 py-3 rounded-lg border transition-all ${
                                        participants.length === 1
                                          ? "w-80"
                                          : participants.length === 2
                                          ? "flex-1 max-w-md"
                                          : participants.length === 3
                                          ? "w-72"
                                          : participants.length === 4
                                          ? "w-52"
                                          : "w-44"
                                      } ${
                                        participant.has_won
                                          ? "bg-green-900 bg-opacity-30 border-green-500 shadow-green-500/20 shadow-lg"
                                          : "bg-red-900 bg-opacity-20 border-red-600"
                                      }`}
                                    >
                                      {/* Player Header */}
                                      <div className="flex items-center space-x-3">
                                        {/* Player Avatar */}
                                        {getProfilePicture({
                                          name: participant.player_name,
                                          display_name:
                                            participant.player_display_name,
                                        } as ExtendedPlayer) ? (
                                          <img
                                            src={
                                              getProfilePicture({
                                                name: participant.player_name,
                                                display_name:
                                                  participant.player_display_name,
                                              } as ExtendedPlayer)!
                                            }
                                            alt={
                                              participant.player_display_name ||
                                              participant.player_name
                                            }
                                            className={`h-10 w-10 rounded-full object-cover border-2 ${
                                              participant.has_won
                                                ? "border-green-400"
                                                : "border-red-400"
                                            }`}
                                          />
                                        ) : (
                                          <div
                                            className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                                              participant.has_won
                                                ? "bg-green-600 border-green-400"
                                                : "bg-red-600 border-red-400"
                                            }`}
                                          >
                                            <span className="text-xs font-bold text-white">
                                              {getInitials({
                                                name: participant.player_name,
                                                display_name:
                                                  participant.player_display_name,
                                              } as ExtendedPlayer)}
                                            </span>
                                          </div>
                                        )}

                                        {/* Player Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-white font-semibold truncate">
                                            {participant.player_display_name ||
                                              participant.player_name}
                                          </div>
                                          <div
                                            className={`text-sm font-medium ${
                                              participant.has_won
                                                ? "text-green-400"
                                                : "text-red-400"
                                            }`}
                                          >
                                            {participant.smash_character}
                                          </div>
                                        </div>

                                        {/* Win/Loss Indicator */}
                                        <div
                                          className={`font-bold text-lg ${
                                            participant.has_won
                                              ? "text-green-400"
                                              : "text-red-400"
                                          }`}
                                        >
                                          {participant.has_won ? "W" : "L"}
                                        </div>
                                      </div>

                                      {/* Individual Player Stats */}
                                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                          <div className="text-orange-400 font-bold">
                                            {participant.total_kos || 0}
                                          </div>
                                          <div className="text-gray-400">
                                            KOs
                                          </div>
                                        </div>
                                        <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                          <div className="text-purple-400 font-bold">
                                            {participant.total_falls || 0}
                                          </div>
                                          <div className="text-gray-400">
                                            Falls
                                          </div>
                                        </div>
                                        <div className="bg-black bg-opacity-20 rounded px-2 py-1">
                                          <div className="text-red-400 font-bold">
                                            {participant.total_sds || 0}
                                          </div>
                                          <div className="text-gray-400">
                                            SDs
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Players Tab */}
            {activeTab === "players" && (
              <div>
                {sortedPlayers.length === 0 ? (
                  <div className="text-gray-400 text-center py-16 bg-gray-900 bg-opacity-50 rounded-2xl">
                    <p className="text-2xl font-bold">
                      No fighters have joined the roster yet!
                    </p>
                    <p className="mt-2 text-lg">
                      Add some players to see their detailed profiles
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-lg relative">
                    {/* Loading overlay when refreshing */}
                    {refreshing && (
                      <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                        <div className="bg-gray-800 bg-opacity-90 px-6 py-3 rounded-full flex items-center space-x-3 border border-gray-600">
                          <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                          <span className="text-white font-medium">
                            Updating player profiles...
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between relative overflow-hidden rounded-t-2xl">
                      {/* Glare effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

                      <div className="flex flex-col md:flex-row items-center relative z-10 justify-between w-full">
                        <div className="flex items-center space-x-2">
                          <Users
                            className="mr-3 text-yellow-500"
                            size={24}
                            style={{
                              filter:
                                "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                            }}
                          />
                          <div>
                            <h2
                              className="text-2xl font-bold text-white"
                              style={{
                                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                              }}
                            >
                              Fighter Profiles
                            </h2>
                          </div>
                        </div>
                        <RefreshStatus
                          refreshing={refreshing}
                          countdown={countdown}
                          lastUpdated={lastUpdated}
                          centered={false}
                        />
                      </div>
                    </div>

                    <div
                      className={`p-6 transition-opacity duration-300 ${
                        refreshing ? "opacity-75" : "opacity-100"
                      }`}
                    >
                      {/* Player Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedPlayers.map((player, index) => {
                          const tier = getTier(player.elo, tierThresholds);
                          const winRate =
                            player.total_wins &&
                            player.total_wins + (player.total_losses || 0) > 0
                              ? (
                                  (player.total_wins /
                                    (player.total_wins +
                                      (player.total_losses || 0))) *
                                  100
                                ).toFixed(1)
                              : "0.0";

                          return (
                            <div
                              key={player.id}
                              id={`player-${player.id}`}
                              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:transform hover:scale-105 shadow-lg relative overflow-hidden"
                            >
                              {/* Rank badge */}
                              <div className="absolute top-4 right-4">
                                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                  #{index + 1}
                                </div>
                              </div>

                              {/* Player Avatar and Info */}
                              <div className="flex flex-col items-center mb-6">
                                <div className="relative mb-4">
                                  {getProfilePicture(player) ? (
                                    <img
                                      src={getProfilePicture(player)!}
                                      alt={player.display_name || player.name}
                                      className="h-20 w-20 rounded-full object-cover border-4 border-gray-600 shadow-xl"
                                    />
                                  ) : (
                                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center border-4 border-gray-600 shadow-xl">
                                      <span className="text-2xl font-bold text-white">
                                        {getInitials(player)}
                                      </span>
                                    </div>
                                  )}
                                  {/* Tier badge on avatar */}
                                  <div
                                    className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getTierBadgeColor(
                                      tier
                                    )} shadow-lg border-2 border-gray-800`}
                                  >
                                    {tier}
                                  </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-1 text-center">
                                  {player.display_name || player.name}
                                </h3>

                                {/* ELO Display */}
                                <div className="bg-gray-700 px-4 py-2 rounded-full mb-2">
                                  <span className="text-yellow-500 font-bold text-lg">
                                    {player.elo} ELO
                                  </span>
                                </div>

                                {/* Main Character */}
                                {player.main_character && (
                                  <div className="bg-blue-900 bg-opacity-50 px-3 py-1 rounded-full border border-blue-500">
                                    <span className="text-blue-300 text-sm font-medium">
                                      Main: {player.main_character}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Stats Section */}
                              <div className="space-y-4">
                                {/* Win/Loss Record */}
                                <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                  <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                    Match Record
                                  </h4>
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                      <span className="text-green-400 font-bold">
                                        Wins
                                      </span>
                                    </div>
                                    <span className="text-white font-bold text-lg">
                                      {player.total_wins || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                      <span className="text-red-400 font-bold">
                                        Losses
                                      </span>
                                    </div>
                                    <span className="text-white font-bold text-lg">
                                      {player.total_losses || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-medium">
                                      Win Rate
                                    </span>
                                    <span className="text-yellow-400 font-bold">
                                      {winRate}%
                                    </span>
                                  </div>
                                </div>

                                {/* Combat Stats */}
                                <div className="bg-gray-700 bg-opacity-50 rounded-lg p-4">
                                  <h4 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wide">
                                    Combat Stats
                                  </h4>
                                  <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                      <div className="text-orange-400 font-bold text-lg">
                                        {player.total_kos || 0}
                                      </div>
                                      <div className="text-gray-400 text-xs uppercase">
                                        KOs
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-purple-400 font-bold text-lg">
                                        {player.total_falls || 0}
                                      </div>
                                      <div className="text-gray-400 text-xs uppercase">
                                        Falls
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-red-400 font-bold text-lg">
                                        {player.total_sds || 0}
                                      </div>
                                      <div className="text-gray-400 text-xs uppercase">
                                        SDs
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Additional Stats */}
                                <div className="grid grid-cols-2 gap-2 text-center">
                                  <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                    <div className="text-blue-400 font-bold">
                                      {player.matches}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      Matches
                                    </div>
                                  </div>
                                  <div className="bg-gray-700 bg-opacity-30 rounded-lg p-2">
                                    <div className="text-cyan-400 font-bold">
                                      {(player.total_kos || 0) > 0 &&
                                      (player.total_falls || 0) +
                                        (player.total_sds || 0) >
                                        0
                                        ? (
                                            (player.total_kos || 0) /
                                            ((player.total_falls || 0) +
                                              (player.total_sds || 0))
                                          ).toFixed(2)
                                        : "0.00"}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      K/D Ratio
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Decorative elements */}
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 mb-6 text-center">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl px-6 py-4 border border-gray-700 shadow-lg max-w-md mx-auto">
          <p className="text-gray-300 text-sm">
            Made with{" "}
            <span className="text-red-500 animate-pulse text-lg">❤️</span> by{" "}
            <a
              href="https://twitter.com/subby_tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 hover:underline"
            >
              subby
            </a>{" "}
            and{" "}
            <a
              href="https://twitter.com/haseab_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 hover:underline"
            >
              haseab
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
