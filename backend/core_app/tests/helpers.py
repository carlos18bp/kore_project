def get_results(data):
    """Extract results list from paginated or plain DRF responses."""
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data
