import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/AppShell";
import {
  Dumbbell,
  Calendar as CalendarIcon,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  Truck,
  Clock,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const eventTypeColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  session: { bg: "bg-blue-100", text: "text-blue-700", icon: Dumbbell },
  delivery: { bg: "bg-green-100", text: "text-green-700", icon: Truck },
  call: { bg: "bg-purple-100", text: "text-purple-700", icon: MessageSquare },
  check_in: { bg: "bg-orange-100", text: "text-orange-700", icon: MessageSquare },
};

export default function TrainerCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range for current month
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return {
      startDate: new Date(year, month, 1).toISOString(),
      endDate: new Date(year, month + 1, 0).toISOString(),
    };
  }, [currentDate]);

  // Fetch calendar events from API
  const { data: apiEvents, isLoading } = trpc.calendar.events.useQuery(dateRange, {
    staleTime: 30000,
  });

  // Transform API events to display format
  const events = useMemo(() => {
    if (!apiEvents || apiEvents.length === 0) return [];
    
    return apiEvents.map((event) => ({
      id: event.id,
      date: new Date(event.startTime).toISOString().split("T")[0],
      time: new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: event.eventType || "session",
      client: event.title,
      duration: Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000),
      product: event.description,
    }));
  }, [apiEvents]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((event) => event.date === dateStr);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  // Get today's events
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayEvents = events.filter((e) => e.date === todayStr);

  return (
    <AppShell title="Calendar">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground">Sessions & deliveries</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Add event feature coming soon")}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Calendar */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-lg">{formatMonth(currentDate)}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                  return (
                    <div
                      key={index}
                      className={`min-h-16 p-1 rounded-lg ${
                        day
                          ? isToday
                            ? "bg-blue-50 border border-blue-500"
                            : "bg-muted/50"
                          : ""
                      }`}
                    >
                      {day && (
                        <>
                          <div
                            className={`text-xs font-medium mb-1 ${
                              isToday ? "text-blue-600" : "text-foreground"
                            }`}
                          >
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map((event) => {
                              const typeConfig = eventTypeColors[event.type] || eventTypeColors.session;
                              return (
                                <div
                                  key={event.id}
                                  className={`w-full h-1.5 rounded-full ${typeConfig.bg}`}
                                />
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-muted-foreground text-center">
                                +{dayEvents.length - 2}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {Object.entries(eventTypeColors).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${config.bg}`} />
              <span className="text-xs text-muted-foreground capitalize">{type.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        {/* Today's Schedule */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : todayEvents.length > 0 ? (
              <div className="space-y-3">
                {todayEvents.map((event) => {
                  const typeConfig = eventTypeColors[event.type] || eventTypeColors.session;
                  const Icon = typeConfig.icon;

                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeConfig.bg}`}
                      >
                        <Icon className={`h-5 w-5 ${typeConfig.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{event.client}</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {event.type === "delivery" ? event.product : event.type.replace("_", " ")}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">{event.time}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No events scheduled for today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
