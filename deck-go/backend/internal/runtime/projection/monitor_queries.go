package projection

import (
	"context"
	"time"
)

type MonitorQueries struct {
	bus EventBus
	now func() time.Time
}

func NewMonitorQueries(bus EventBus) *MonitorQueries {
	return &MonitorQueries{
		bus: bus,
		now: time.Now,
	}
}

func (q *MonitorQueries) ListRuns(context.Context, string) ([]RunRecord, error) {
	return AggregateRuns(q.bus), nil
}

func (q *MonitorQueries) GetRun(_ context.Context, _ string, runID string) (RunRecord, []RunEventRow, bool, error) {
	runs := AggregateRuns(q.bus)
	for _, run := range runs {
		if run.RunID == runID {
			return run, AggregateRunEvents(q.bus, runID), true, nil
		}
	}
	return RunRecord{}, nil, false, nil
}

func (q *MonitorQueries) GetStats(context.Context, string) (MonitorStats, error) {
	return BuildMonitorStats(AggregateRuns(q.bus), q.now()), nil
}

func (q *MonitorQueries) ListActivity(_ context.Context, _ string, limit int) ([]ActivityEventEntry, error) {
	return CollectActivityEntries(q.bus, limit), nil
}
