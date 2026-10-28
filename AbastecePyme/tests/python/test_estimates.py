import unittest
from backend.Estimates import CalculateEstimate, ParseDecimal

class EstimateTests(unittest.TestCase):
    def test_cheapest_alternative(self):
        Relations = [
            {"SourceId":"S1","TargetId":"M1","RelationType":"Offer","Value":"12.00","IsDemo":True},
            {"SourceId":"S2","TargetId":"M1","RelationType":"Offer","Value":"10.20","IsDemo":True},
            {"SourceId":"S1","TargetId":"M2","RelationType":"Offer","Value":"3.10","IsDemo":False},
            {"SourceId":"M1","TargetId":"P","RelationType":"Requirement","Value":"1.5","IsDemo":True},
            {"SourceId":"M2","TargetId":"P","RelationType":"Requirement","Value":"2","IsDemo":False}]
        Result = CalculateEstimate("P", [], Relations)
        self.assertEqual(Result["Total"], "21.50")
        self.assertTrue(Result["IsComplete"])
        self.assertEqual(Result["Choices"][0]["SupplierId"], "S2")
        self.assertTrue(Result["IsDemo"])

    def test_missing_offer_and_general_dependency(self):
        Result = CalculateEstimate("P", [], [{"SourceId":"M","TargetId":"P","RelationType":"Requirement","Value":"1","IsDemo":False}])
        self.assertFalse(Result["IsComplete"])
        self.assertEqual(Result["Missing"], ["M"])
        self.assertFalse(CalculateEstimate("P", [], [{"SourceId":"P","TargetId":"P","RelationType":"General","Value":None}])["IsComplete"])

    def test_decimal_bounds(self):
        for Value in ["NaN","Infinity","-1","1.001","10000000000000000",True,1.23]:
            with self.subTest(Value=Value), self.assertRaises(ValueError):
                ParseDecimal(Value, 2, False)
        for Value in ["0","-1","0.00001","100000000000000"]:
            with self.subTest(Value=Value), self.assertRaises(ValueError):
                ParseDecimal(Value, 4, True)
        self.assertEqual(str(ParseDecimal("0",2,False)),"0.00")
        self.assertEqual(str(ParseDecimal("0.1250",4,True)),"0.1250")

