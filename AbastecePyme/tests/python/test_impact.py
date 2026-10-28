import copy
import unittest
from backend.Impact import AnalyzeImpact

def Fixture():
    Elements = [
        {"ElementId": Key, "Name": Name, "ElementType": Kind, "Description": "", "Version": 1, "Contact": None, "UnitCode": "unidad"}
        for Key, Name, Kind in [
            ("S1","Supplier one","Supplier"), ("S2","Supplier two","Supplier"),
            ("M1","Material one","Material"), ("M2","Material two","Material"),
            ("P1","Product one","Product"), ("P2","Product two","Product"), ("ZZ","Isolated","Material")]]
    Relations = [
        {"SourceId": Source, "TargetId": Target, "RelationType": Kind, "Value": Value, "IsDemo": True, "Version": 1}
        for Source, Target, Kind, Value in [
            ("S1","M2","Offer","9.00"), ("S2","M1","Offer","1.00"),
            ("M2","P1","Requirement","2.0000"), ("S1","M1","Offer","12.00"),
            ("M1","P1","Requirement","1.0000"), ("P1","P2","General",None)]]
    return {"Elements": Elements, "Relations": Relations}

class ImpactTests(unittest.TestCase):
    def setUp(self):
        self.Data = Fixture()

    def Analyze(self, ElementId, Direction="Consequences"):
        return AnalyzeImpact(ElementId, self.Data["Elements"], self.Data["Relations"], Direction)

    def test_branch_diamond_and_long_chain(self):
        Result = self.Analyze("S1")
        self.assertEqual([Row["ElementId"] for Row in Result["Visited"]], ["S1","M1","M2","P1","P2"])
        self.assertEqual([Row["Depth"] for Row in Result["Visited"]], [0,1,1,2,3])
        self.assertEqual(Result["Reached"][-1]["Path"], ["S1","M1","P1","P2"])
        self.assertEqual(Result["Summary"], {"Total":4,"Direct":2,"Indirect":2,"Products":2})
        self.assertEqual(Result["Status"], "Reached")
        self.assertEqual(Result["Meaning"], "PotentialImpact")

    def test_reverse_prerequisites_and_stored_arrow_direction(self):
        Result = self.Analyze("P2", "Requirements")
        self.assertEqual([Row["ElementId"] for Row in Result["Visited"]], ["P2","P1","M1","M2","S1","S2"])
        self.assertEqual(Result["Reached"][-1]["Path"], ["P2","P1","M1","S2"])
        self.assertEqual(Result["Meaning"], "Prerequisites")
        self.assertIn(("S2","M1"), [(Edge["SourceId"],Edge["TargetId"]) for Edge in Result["Graph"]["Relations"]])

    def test_alternative_supplier_does_not_hide_potential_impact(self):
        Result = self.Analyze("S2")
        self.assertEqual([Row["ElementId"] for Row in Result["Reached"]], ["M1","P1","P2"])
        self.assertNotIn("S1", [Row["ElementId"] for Row in Result["Visited"]])

    def test_isolated_and_sink_are_successful_empty_results(self):
        for Key in ["ZZ","P2"]:
            with self.subTest(Key=Key):
                Result = self.Analyze(Key)
                self.assertEqual(Result["Status"], "NoReachable")
                self.assertEqual(Result["Reached"], [])
                self.assertEqual(len(Result["Visited"]), 1)
        self.assertEqual(self.Analyze("S1","Requirements")["Status"], "NoReachable")
        self.assertGreater(self.Analyze("P2","Requirements")["Summary"]["Total"], 0)

    def test_unknown_element_is_distinct_from_empty(self):
        with self.assertRaises(KeyError):
            self.Analyze("MISSING")

    def test_cycles_and_self_loop_visit_root_once(self):
        self.Data["Relations"] += [
            {"SourceId":"P2","TargetId":"S1","RelationType":"General","Value":None},
            {"SourceId":"S1","TargetId":"S1","RelationType":"General","Value":None}]
        Result = self.Analyze("S1")
        self.assertEqual([Row["ElementId"] for Row in Result["Visited"]], ["S1","M1","M2","P1","P2"])
        self.assertNotIn("S1", [Row["ElementId"] for Row in Result["Reached"]])
        self.assertEqual(self.Analyze("ZZ")["Summary"]["Total"],0)

    def test_self_loop_only_has_no_other_reachable_elements(self):
        self.Data["Relations"].append({"SourceId":"ZZ","TargetId":"ZZ","RelationType":"General","Value":None})
        self.assertEqual(self.Analyze("ZZ")["Status"],"NoReachable")

    def test_results_deterministic_and_input_unchanged(self):
        Before = copy.deepcopy(self.Data)
        First = self.Analyze("S1")
        self.assertEqual(self.Data, Before)
        self.Data["Elements"].reverse()
        self.Data["Relations"].reverse()
        self.assertEqual(self.Analyze("S1"), First)

    def test_deep_chain_is_iterative(self):
        Elements = [{"ElementId":f"N{Index}","Name":f"Node {Index}","ElementType":"Material"} for Index in range(1100)]
        Relations = [{"SourceId":f"N{Index}","TargetId":f"N{Index+1}","RelationType":"General","Value":None} for Index in range(1099)]
        Result = AnalyzeImpact("N0", Elements, Relations)
        self.assertEqual(Result["Summary"]["Total"],1099)
        self.assertEqual(Result["Reached"][-1]["Depth"],1099)
        self.assertEqual(len(Result["Reached"][-1]["Path"]),1100)

    def test_invalid_direction_rejected_by_algorithm(self):
        with self.assertRaises(ValueError):
            self.Analyze("S1","Sideways")

