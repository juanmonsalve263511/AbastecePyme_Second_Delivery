"""Exact material estimates; suppliers represent alternative offers."""
from decimal import Decimal, InvalidOperation, localcontext

def ParseDecimal(Value, Scale, Positive):
    if not isinstance(Value, str) or len(Value) > 40:
        raise ValueError("Use una cadena decimal.")
    try:
        Number = Decimal(Value)
        if not Number.is_finite() or Number < 0 or (Positive and Number == 0):
            raise ValueError("Valor fuera de rango.")
        if Number >= Decimal(10) ** (18 - Scale):
            raise ValueError("Valor demasiado grande.")
        Quantum = Decimal(1).scaleb(-Scale)
        if Number != Number.quantize(Quantum):
            raise ValueError("Demasiados decimales.")
        return Number.quantize(Quantum)
    except InvalidOperation:
        raise ValueError("Decimal inválido.") from None

def CalculateEstimate(ProductId, Elements, Relations):
    Offers = {}
    Requirements = []
    Missing = []
    Complete = True
    for Edge in Relations:
        if Edge["RelationType"] == "Offer":
            Offers.setdefault(Edge["TargetId"], []).append(Edge)
        if Edge["TargetId"] == ProductId:
            if Edge["RelationType"] == "Requirement":
                Requirements.append(Edge)
            else:
                Complete = False
    Choices = []
    Total = Decimal("0")
    Demo = False
    with localcontext() as Context:
        Context.prec = 60
        for Edge in sorted(Requirements, key=lambda Item: Item["SourceId"]):
            MaterialId = Edge["SourceId"]
            Options = Offers.get(MaterialId, [])
            if not Options:
                Missing.append(MaterialId)
                continue
            Offer = min(Options, key=lambda Item: (Decimal(Item["Value"]), Item["SourceId"]))
            Cost = Decimal(Edge["Value"]) * Decimal(Offer["Value"])
            Total += Cost
            Demo = Demo or bool(Edge["IsDemo"]) or bool(Offer["IsDemo"])
            Choices.append({"MaterialId":MaterialId, "SupplierId":Offer["SourceId"],
                            "Quantity":Edge["Value"], "UnitPrice":Offer["Value"],
                            "Subtotal":str(Cost.quantize(Decimal("0.01")))})
        return {"Total":str(Total.quantize(Decimal("0.01"))), "CurrencyCode":"COP",
                "IsComplete":Complete and not Missing and bool(Requirements),
                "IsDemo":Demo, "Choices":Choices, "Missing":Missing}

