def format_number(value):
    if value > 1_000_000:
        return f"{value/1_000_000:.2f} Mi"
    elif value > 1_000:
        return f"{value/1_000:.2f} Mil"
    else:
        return str(int(value))
