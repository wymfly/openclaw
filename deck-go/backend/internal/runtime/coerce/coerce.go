package coerce

func String(value any, fallback string) string {
	if s, ok := value.(string); ok {
		return s
	}
	return fallback
}

func FirstString(values ...any) string {
	for _, value := range values {
		if s, ok := value.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func Number(value any) float64 {
	switch n := value.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case uint64:
		return float64(n)
	default:
		return 0
	}
}

func FirstNumber(values ...any) float64 {
	for _, value := range values {
		if number := Number(value); number != 0 {
			return number
		}
	}
	return 0
}

func Bool(value any) bool {
	b, _ := value.(bool)
	return b
}

func Map(value any) map[string]any {
	record, _ := value.(map[string]any)
	return record
}
