"use client";

import { Player } from "@/lib/supabase";
import { ArrowUpDown, List, Trophy } from "lucide-react";
import { memo, useEffect, useState } from "react";

// Extended player interface for frontend with real stats
interface ExtendedPlayer extends Player {
  matches: number;
}

type Tier = "S" | "A" | "B" | "C" | "D" | "E";

// Memoized component for refresh status to prevent unnecessary rerenders
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
  const [activeTab, setActiveTab] = useState<"tiers" | "rankings">("rankings");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(30);

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

  // Constants for tier classification
  const TIER_THRESHOLDS = {
    S: 1800,
    A: 1600,
    B: 1400,
    C: 1200,
    D: 1000,
  };

  // Fetch players from database
  useEffect(() => {
    fetchPlayers();

    // Set up automatic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchPlayers(true); // Pass true to indicate this is a background refresh
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

  // Determine tier based on ELO
  const getTier = (elo: number): Tier => {
    if (elo >= TIER_THRESHOLDS.S) return "S";
    if (elo >= TIER_THRESHOLDS.A) return "A";
    if (elo >= TIER_THRESHOLDS.B) return "B";
    if (elo >= TIER_THRESHOLDS.C) return "C";
    if (elo >= TIER_THRESHOLDS.D) return "D";
    return "E";
  };

  // Sort players by ELO
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

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
    const tier = getTier(player.elo);
    tierList[tier].push(player);
  });

  return (
    <div
      className="p-6 md:p-0 min-h-screen bg-black text-white antialiased"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.4) 0%, rgba(0, 0, 0, 0.8) 100%)",
        backgroundAttachment: "fixed",
        fontFamily: "'Roboto Mono', monospace",
      }}
    >
      {/* Smash-style header */}
      <header className="max-w-5xl mx-auto bg-gradient-to-r from-red-600 to-red-700 border-b-4 border-yellow-500 shadow-lg relative overflow-hidden rounded-3xl md:mt-4">
        {/* Glare effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>

        <div className="max-w-5xl mx-auto py-6 flex justify-center items-center relative z-10">
          <div className="flex items-center space-x-8">
            {/* Founders Inc Logo */}
            <img
              src="/images/founders-icon.png"
              alt="Founders Inc Logo"
              className="h-12 w-auto object-contain"
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))",
              }}
            />

            <h1
              className="text-5xl font-bold tracking-wide uppercase text-white"
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
      <nav className="max-w-5xl mx-auto bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 shadow-md sticky top-0 z-50 mt-6 rounded-xl mx-4">
        <div className="max-w-5xl mx-auto">
          <ul className="flex rounded-xl overflow-hidden">
            {[
              { id: "rankings", icon: <Trophy size={20} />, label: "Rankings" },
              { id: "tiers", icon: <List size={20} />, label: "Fighters" },
            ].map((tab, index) => (
              <li key={tab.id} className="flex-1">
                <button
                  onClick={() => setActiveTab(tab.id as "tiers" | "rankings")}
                  className={`w-full px-8 py-5 flex items-center justify-center space-x-3 transition-all duration-200 relative overflow-hidden text-xl font-semibold ${
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
                        : "0 0.75rem 0.75rem 0",
                  }}
                >
                  {/* Glare effect for active tab */}
                  {activeTab === tab.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-10 skew-x-12 transform -translate-x-full"></div>
                  )}

                  <span className="relative z-10">{tab.icon}</span>
                  <span className="relative z-10">{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto py-3">
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

                  <div className="flex items-center relative z-10 justify-between w-full">
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
                            <th className="px-6 py-6 text-left text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tl-xl w-24">
                              Rank
                            </th>
                            <th className="px-6 py-6 text-left text-lg font-bold text-gray-300 uppercase tracking-wider">
                              Player
                            </th>
                            {/* <th className="px-4 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider w-32">
                              Main
                            </th> */}
                            <th className="px-6 py-6 text-left text-lg font-bold text-gray-300 uppercase tracking-wider w-32">
                              <div className="flex items-center">
                                <span>ELO</span>
                                <ArrowUpDown
                                  size={20}
                                  className="ml-2 text-gray-500"
                                />
                              </div>
                            </th>
                            <th className="px-6 py-6 text-left text-lg font-bold text-gray-300 uppercase tracking-wider rounded-tr-xl w-24">
                              Tier
                            </th>
                            {/* <th className="px-4 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider rounded-tr-xl w-32">
                              Record
                            </th> */}
                          </tr>
                        </thead>
                        <tbody className="bg-gray-900 divide-y divide-gray-800">
                          {sortedPlayers.map((player, index) => {
                            const tier = getTier(player.elo);
                            const isLast = index === sortedPlayers.length - 1;
                            return (
                              <tr
                                key={player.id}
                                className="hover:bg-gray-800 transition-colors duration-150"
                              >
                                <td
                                  className={`px-6 py-8 whitespace-nowrap ${
                                    isLast ? "rounded-bl-xl" : ""
                                  }`}
                                >
                                  <div className="flex items-center">
                                    <span className="text-3xl font-bold text-white">
                                      #{index + 1}
                                    </span>
                                    {index === 0 && (
                                      <Trophy
                                        size={24}
                                        className="ml-3 text-yellow-500"
                                        style={{
                                          filter:
                                            "drop-shadow(0 0 5px rgba(255, 215, 0, 0.5))",
                                        }}
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-8 whitespace-nowrap text-2xl font-bold text-white">
                                  <div className="flex items-center space-x-4">
                                    {getProfilePicture(player) ? (
                                      <img
                                        src={getProfilePicture(player)!}
                                        alt={player.display_name || player.name}
                                        className="h-14 w-14 rounded-full object-cover border-2 border-gray-600"
                                      />
                                    ) : (
                                      <div className="h-14 w-14 rounded-full bg-gray-700 flex items-center justify-center border-2 border-gray-600">
                                        <span className="text-lg font-bold text-gray-300">
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
                                <td className="px-6 py-8 whitespace-nowrap">
                                  <span
                                    className="text-2xl font-bold text-yellow-500 bg-gray-800 px-4 py-2 rounded-full"
                                    style={{
                                      textShadow:
                                        "0 0 10px rgba(255, 215, 0, 0.6)",
                                    }}
                                  >
                                    {player.elo}
                                  </span>
                                </td>
                                <td
                                  className={`px-6 py-8 whitespace-nowrap ${
                                    isLast ? "rounded-br-xl" : ""
                                  }`}
                                >
                                  <span
                                    className={`px-4 py-2 inline-flex text-lg font-bold rounded-full ${getTierBadgeColor(
                                      tier
                                    )} shadow-lg`}
                                  >
                                    {tier}
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
                  <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-lg relative">
                    {/* Loading overlay when refreshing */}
                    {refreshing && (
                      <div className="absolute inset-0 bg-black bg-opacity-20 z-10 flex items-center justify-center backdrop-blur-sm">
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

                            // Get tier colors matching official tier list
                            const getTierRowColor = (tier: Tier): string => {
                              switch (tier) {
                                case "S":
                                  return "bg-red-500";
                                case "A":
                                  return "bg-orange-500";
                                case "B":
                                  return "bg-yellow-500";
                                case "C":
                                  return "bg-green-500";
                                case "D":
                                  return "bg-blue-500";
                                case "E":
                                  return "bg-purple-500";
                                default:
                                  return "bg-gray-500";
                              }
                            };

                            return (
                              <div
                                key={tierName}
                                className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
                              >
                                {/* Tier Label */}
                                <div
                                  className={`${getTierRowColor(
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
                                <div className="flex-1 p-4">
                                  {tierPlayers.length === 0 ? (
                                    <div className="flex items-center justify-center h-16 text-gray-500 italic">
                                      No players in this tier
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {tierPlayers.map((player) => (
                                        <div
                                          key={player.id}
                                          className="relative group"
                                          title={`${
                                            player.display_name || player.name
                                          } - ELO: ${player.elo}`}
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
                                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black bg-opacity-90 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                            <div className="font-semibold">
                                              {player.display_name ||
                                                player.name}
                                            </div>
                                            <div className="text-yellow-400 font-bold">
                                              ELO: {player.elo}
                                            </div>
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black border-opacity-90"></div>
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
          </>
        )}
      </main>
    </div>
  );
}
